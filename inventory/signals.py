from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import threading

from .middleware import get_current_user
from .models import Category, Supplier, Product, Purchase, Sale, AuditLog, Stock, Notification

TRACKED_MODELS = [Category, Supplier, Product, Purchase, Sale]


def _log(action, instance):
    user = get_current_user()
    # Ignore anonymous / unauthenticated users
    if user and not user.is_authenticated:
        user = None
    
    # Special handling for User model updates - if no current user is found,
    # assume the user updated themselves (e.g., during login/profile update)
    if user is None and instance.__class__.__name__ == 'User' and action == 'UPDATE':
        user = instance
    
    AuditLog.objects.create(
        user=user,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
    )


@receiver(post_save)
def on_save(sender, instance, created, **kwargs):
    if sender not in TRACKED_MODELS:
        return
    if sender is Purchase and not created:
        return
    _log('CREATE' if created else 'UPDATE', instance)


@receiver(post_delete)
def on_delete(sender, instance, **kwargs):
    if sender not in TRACKED_MODELS:
        return
    _log('DELETE', instance)


# ── User management actions ────────────────────────────────────────────────────

User = get_user_model()


@receiver(post_save, sender=User)
def on_user_save(sender, instance, created, **kwargs):
    _log('CREATE' if created else 'UPDATE', instance)


@receiver(post_delete, sender=User)
def on_user_delete(sender, instance, **kwargs):
    _log('DELETE', instance)


# ── Low Stock Alerts ───────────────────────────────────────────────────────────

@receiver(pre_save, sender=Stock)
def stock_pre_save(sender, instance, **kwargs):
    """Store the old quantity before save so we can detect threshold crossings."""
    if instance.pk:
        try:
            instance._old_quantity = Stock.objects.get(pk=instance.pk).quantity
        except Stock.DoesNotExist:
            instance._old_quantity = None
    else:
        instance._old_quantity = None


def _send_low_stock_email(product_name, quantity, threshold, admin_emails):
    """Send low-stock alert email — called in a background thread."""
    if not getattr(settings, 'LOW_STOCK_EMAIL_ENABLED', False):
        return
    subject = f"[InvMS] Low Stock Alert: {product_name}"
    body = (
        f"Low Stock Alert\n"
        f"{'─' * 40}\n"
        f"Product  : {product_name}\n"
        f"Quantity : {quantity}\n"
        f"Threshold: {threshold}\n\n"
        f"Please restock as soon as possible.\n\n"
        f"— InvMS Inventory Management System"
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL,
                  admin_emails, fail_silently=True)
    except Exception:
        pass  # Never crash a request over an email failure


@receiver(post_save, sender=Stock)
def stock_post_save(sender, instance, created, **kwargs):
    """
    Fire low-stock alert when quantity just dropped to/below the threshold.
    Uses _old_quantity (set by pre_save) to detect the crossing — avoids
    spamming if the stock was already low before this save.
    Also suppresses duplicate in-app notifications: only creates one if there
    is no existing unread notification for this product from today.
    """
    if not instance.is_low_stock:
        return  # quantity is fine

    old_qty = getattr(instance, '_old_quantity', None)
    # Only alert on a downward crossing (or first save) — not on every re-save
    if old_qty is not None and old_qty <= instance.low_stock_threshold:
        return  # was already low; no need to re-alert

    product = instance.product
    title   = f"Low Stock: {product.name}"
    message = (
        f"{product.name} is running low. "
        f"Current quantity: {instance.quantity} "
        f"(threshold: {instance.low_stock_threshold})."
    )

    # Avoid duplicate in-app notifications for the same product on the same day
    today = timezone.now().date()
    admin_users = list(
        User.objects.filter(role='admin', is_active=True)
    )

    for admin in admin_users:
        already_notified = Notification.objects.filter(
            user=admin, product=product,
            created_at__date=today, is_read=False,
        ).exists()
        if not already_notified:
            Notification.objects.create(
                user=admin, title=title, message=message, product=product
            )

    # Send email asynchronously so the request is never delayed
    admin_emails = [u.email for u in admin_users if u.email]
    if admin_emails:
        t = threading.Thread(
            target=_send_low_stock_email,
            args=(product.name, instance.quantity, instance.low_stock_threshold, admin_emails),
            daemon=True,
        )
        t.start()
