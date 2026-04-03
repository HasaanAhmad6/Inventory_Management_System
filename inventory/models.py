from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from django.utils import timezone
import json


# Soft Delete Manager
class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        """Soft delete: mark as deleted instead of removing"""
        return self.update(is_deleted=True, deleted_at=timezone.now())
    
    def hard_delete(self):
        """Actual permanent deletion"""
        return super().delete()

    def alive(self):
        """Only non-deleted items (alias for default queryset)"""
        return self.filter(is_deleted=False)

    def deleted_only(self):
        """Only deleted items"""
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        """By default, exclude deleted items"""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def deleted(self):
        """Get deleted items"""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=True)

    def all_with_deleted(self):
        """Get all items including deleted"""
        return SoftDeleteQuerySet(self.model, using=self._db)


class SoftDeleteUserManager(UserManager):
    def get_queryset(self):
        """By default, exclude soft-deleted users."""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def deleted(self):
        """Get only soft-deleted users."""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=True)

    def all_with_deleted(self):
        """Get all users including soft-deleted users."""
        return SoftDeleteQuerySet(self.model, using=self._db)

    def get_by_natural_key(self, username):
        """Required by Django auth management commands (e.g., createsuperuser)."""
        return self.all_with_deleted().get(**{self.model.USERNAME_FIELD: username})


class User(AbstractUser):
    LEGACY_PERMISSION_MAP = {
        'products.view': ('products.read',),
        'products.manage': ('products.create', 'products.read', 'products.update', 'products.delete'),
    }
    ALL_ASSIGNABLE_PERMISSIONS = (
        'sales.create',
        'sales.history.view',
        'stock.view',
        'forecast.view',
        'products.create',
        'products.read',
        'products.update',
        'products.delete',
        'purchases.view',
        'purchases.manage',
        'categories.manage',
        'suppliers.manage',
        'audit.view',
        'trash.access',
        'vouchers.manage',
    )
    STAFF_DEFAULT_PERMISSIONS = ()
    ADMIN_DEFAULT_PERMISSIONS = ()
    STAFF_ASSIGNABLE_PERMISSIONS = ALL_ASSIGNABLE_PERMISSIONS
    ADMIN_ASSIGNABLE_PERMISSIONS = ALL_ASSIGNABLE_PERMISSIONS

    ROLE_CHOICES = [('admin', 'Admin'), ('staff', 'Staff')]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='staff')
    staff_permissions = models.TextField(blank=True, default='')

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_users')

    objects = SoftDeleteUserManager()

    @classmethod
    def normalize_permissions(cls, permissions_list):
        normalized = set()
        for permission in permissions_list or []:
            key = str(permission)
            mapped = cls.LEGACY_PERMISSION_MAP.get(key)
            if mapped:
                normalized.update(mapped)
            else:
                normalized.add(key)
        return sorted(normalized)

    def _deserialize_staff_permissions(self):
        if not self.staff_permissions:
            return []
        try:
            value = json.loads(self.staff_permissions)
            if isinstance(value, list):
                return self.normalize_permissions(value)
        except (TypeError, ValueError):
            pass
        return []

    def _has_explicit_permissions(self):
        return bool((self.staff_permissions or '').strip())

    def _allowed_permissions_for_role(self):
        if self.role == 'admin':
            return set(self.ADMIN_ASSIGNABLE_PERMISSIONS)
        return set(self.STAFF_ASSIGNABLE_PERMISSIONS)

    def _default_permissions_for_role(self):
        if self.role == 'admin':
            return set(self.ADMIN_DEFAULT_PERMISSIONS)
        return set(self.STAFF_DEFAULT_PERMISSIONS)

    def get_effective_permissions(self):
        if self.is_superuser:
            return list(self.ALL_ASSIGNABLE_PERMISSIONS)
        # Backward compatibility: existing admin accounts without explicit saved
        # permissions keep legacy full access until edited.
        if self.role == 'admin' and not self._has_explicit_permissions():
            return list(self.ALL_ASSIGNABLE_PERMISSIONS)
        base = self._default_permissions_for_role()
        assigned = set(self._deserialize_staff_permissions())
        valid_assigned = assigned.intersection(self._allowed_permissions_for_role())
        return sorted(base.union(valid_assigned))

    def set_staff_permissions(self, permissions_list):
        requested = set(self.normalize_permissions(permissions_list))
        valid = sorted(requested.intersection(self._allowed_permissions_for_role()))
        self.staff_permissions = json.dumps(valid)

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()

    def __str__(self):
        return f"{self.username} ({self.role})"



class Voucher(models.Model):
    VOUCHER_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]
    code = models.CharField(max_length=50, unique=True)
    voucher_type = models.CharField(max_length=20, choices=VOUCHER_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Maximum discount amount (capital) for percentage vouchers')
    min_spend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    limit_usage = models.IntegerField(default=1, help_text='How many times this voucher can be used in total')
    used_count = models.IntegerField(default=0)
    expiry_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    specific_product = models.ForeignKey('Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers')
    specific_customer = models.CharField(max_length=200, blank=True, default='', help_text='Only valid for this customer name (case-insensitive)')

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_vouchers')

    objects = SoftDeleteManager()

    def is_valid_voucher(self, total_amount=0, customer_name=None, products_in_cart=None):
        if not self.is_active or self.is_deleted:
            return False, 'Voucher is inactive.'
        if self.expiry_date < timezone.now():
            return False, 'Voucher has expired.'
        if self.used_count >= self.limit_usage:
            return False, 'Voucher usage limit reached.'
        if total_amount < self.min_spend:
            return False, f'Minimum spend of {self.min_spend} required.'

        if self.specific_customer:
            if not customer_name or self.specific_customer.strip().lower() != customer_name.strip().lower():
                return False, f'This voucher is only valid for customer: {self.specific_customer}.'

        if self.specific_product:
            if not products_in_cart or self.specific_product.id not in [p.id for p in products_in_cart]:
                return False, f'This voucher is only valid for product: {self.specific_product.name}.'

        return True, ''

    def __str__(self):
        return f"{self.code} ({self.voucher_type})"

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_categories')

    objects = SoftDeleteManager()

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Supplier(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    address = models.TextField()

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_suppliers')

    objects = SoftDeleteManager()

    def __str__(self):
        return self.name

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Product(models.Model):
    name        = models.CharField(max_length=200)
    sku         = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2, default=0) # purchase / cost price
    sale_price  = models.DecimalField(max_digits=10, decimal_places=2, default=0) # effective discounted selling price
    full_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    image       = models.ImageField(upload_to='products/', blank=True, null=True)
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    supplier    = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_products')

    objects = SoftDeleteManager()

    def __str__(self):
        return f"{self.name} ({self.sku})"

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Stock(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='stock')
    quantity = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=10)
    
    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_stocks')

    objects = SoftDeleteManager()

    @property
    def is_low_stock(self):
        return self.quantity <= self.low_stock_threshold

    def __str__(self):
        return f"{self.product.name} - Qty: {self.quantity}"

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Purchase(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchases')
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    full_selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    date = models.DateTimeField(auto_now_add=True)

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_purchases')

    objects = SoftDeleteManager()

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class Sale(models.Model):
    COSTING_METHOD_CHOICES = [
        ('average', 'Average'),
        ('fifo', 'FIFO'),
    ]
    product       = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sales')
    bill_id       = models.CharField(max_length=40, db_index=True, blank=True, default='')
    customer_name = models.CharField(max_length=200)
    quantity      = models.IntegerField()
    unit_price    = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    costing_method = models.CharField(max_length=10, choices=COSTING_METHOD_CHOICES, default='average')
    voucher        = models.ForeignKey(Voucher, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes         = models.TextField(blank=True)
    date          = models.DateTimeField(auto_now_add=True)

    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_sales')

    objects = SoftDeleteManager()

    def delete(self, using=None, keep_parents=False):
        """Override to soft delete"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """Permanent deletion"""
        super().delete()

    def restore(self):
        """Restore from trash"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    user        = models.ForeignKey(
        'inventory.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audit_logs'
    )
    action      = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name  = models.CharField(max_length=100)
    object_id   = models.CharField(max_length=50)
    object_repr = models.CharField(max_length=255)
    timestamp   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} | {self.user} | {self.action} | {self.model_name} #{self.object_id}"


class Notification(models.Model):
    user       = models.ForeignKey(
        'inventory.User', on_delete=models.CASCADE, related_name='notifications'
    )
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    product    = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.title}"

