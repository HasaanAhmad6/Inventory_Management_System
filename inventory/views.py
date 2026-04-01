import base64
from rest_framework import generics, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum, F, FloatField, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.db import models
from django.http import HttpResponse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import datetime
import uuid
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import io

from .models import Category, Supplier, Product, Stock, Purchase, Sale, AuditLog, Notification, Voucher
from .serializers import (
    RegisterSerializer, CategorySerializer, SupplierSerializer,
    ProductSerializer, PurchaseSerializer, SaleSerializer, AuditLogSerializer, VoucherSerializer,
    NotificationSerializer, LoginSerializer,
)
from .permissions import (
    has_capability,
    is_operational_admin,
)
from rest_framework_simplejwt.tokens import RefreshToken
from decimal import Decimal

User = get_user_model()
MONEY_OUTPUT_FIELD = DecimalField(max_digits=18, decimal_places=2)
MONEY_ZERO = Decimal('0.00')

def _effective_lot_selling_price(lot):
    explicit_selling = float(lot.get('selling_price') or 0)
    if explicit_selling > 0:
        return explicit_selling

    full_selling = float(lot.get('full_selling_price') or 0)
    if full_selling <= 0:
        return None

    discount_percent = float(lot.get('discount_percent') or 0)
    discount_percent = max(0.0, min(100.0, discount_percent))
    effective_selling = full_selling * (1 - (discount_percent / 100.0))
    return effective_selling if effective_selling > 0 else None


def _is_valid_positive(value):
    return value is not None and float(value) > 0


def _average_unit_pricing(product):
    lots = list(product.purchases.values(
        'quantity',
        'unit_cost',
        'selling_price',
        'full_selling_price',
        'discount_percent',
    ))
    total_qty = 0
    total_cost = 0.0
    total_selling = 0.0
    fallback_selling = float(product.sale_price or 0)

    for lot in lots:
        lot_qty = int(lot.get('quantity') or 0)
        if lot_qty <= 0:
            continue
        lot_unit_cost = float(lot.get('unit_cost') or 0)
        lot_unit_selling = _effective_lot_selling_price(lot)
        if not _is_valid_positive(lot_unit_selling):
            lot_unit_selling = fallback_selling if _is_valid_positive(fallback_selling) else None
        if not _is_valid_positive(lot_unit_cost) or not _is_valid_positive(lot_unit_selling):
            return None
        total_qty += lot_qty
        total_cost += lot_unit_cost * lot_qty
        total_selling += lot_unit_selling * lot_qty

    if total_qty <= 0:
        return None
    return {
        'unit_cost': total_cost / total_qty,
        'unit_selling_price': total_selling / total_qty,
    }


def _fifo_unit_pricing(product, requested_qty):
    qty_needed = int(requested_qty)
    if qty_needed <= 0:
        return None

    lot_cost_total = 0.0
    lot_selling_total = 0.0
    sold_qty_before = int(product.sales.aggregate(t=Coalesce(Sum('quantity'), 0))['t'] or 0)
    remaining_offset = sold_qty_before
    fallback_selling = float(product.sale_price or 0)
    lots = list(product.purchases.order_by('date', 'id').values(
        'quantity',
        'unit_cost',
        'selling_price',
        'full_selling_price',
        'discount_percent',
    ))

    for lot in lots:
        lot_qty = int(lot['quantity'] or 0)
        if lot_qty <= 0:
            continue
        if remaining_offset >= lot_qty:
            remaining_offset -= lot_qty
            continue

        available_in_lot = lot_qty - remaining_offset
        take = min(available_in_lot, qty_needed)
        lot_unit_cost = float(lot.get('unit_cost') or 0)
        lot_unit_selling = _effective_lot_selling_price(lot)
        if not _is_valid_positive(lot_unit_selling):
            lot_unit_selling = fallback_selling if _is_valid_positive(fallback_selling) else None
        if not _is_valid_positive(lot_unit_cost) or not _is_valid_positive(lot_unit_selling):
            return None
        lot_cost_total += lot_unit_cost * take
        lot_selling_total += lot_unit_selling * take
        qty_needed -= take
        remaining_offset = 0
        if qty_needed == 0:
            break

    if qty_needed > 0:
        return None
    requested_qty = int(requested_qty)
    return {
        'unit_cost': lot_cost_total / requested_qty,
        'unit_selling_price': lot_selling_total / requested_qty,
    }


def _compute_sale_unit_pricing(product, requested_qty, method='average'):
    chosen_method = str(method or 'average').strip().lower()
    if chosen_method == 'fifo':
        return _fifo_unit_pricing(product, requested_qty)
    return _average_unit_pricing(product)


def _has_cost_or_price_variation(product):
    cost_varies = product.purchases.values('unit_cost').distinct().count() > 1
    if cost_varies:
        return True
    effective_prices = set()
    fallback_selling = float(product.sale_price or 0)
    lots = product.purchases.values('selling_price', 'full_selling_price', 'discount_percent')
    for lot in lots:
        unit_selling = _effective_lot_selling_price(lot)
        if not _is_valid_positive(unit_selling):
            unit_selling = fallback_selling if _is_valid_positive(fallback_selling) else None
        if _is_valid_positive(unit_selling):
            effective_prices.add(round(float(unit_selling), 4))
        if len(effective_prices) > 1:
            return True
    return False


def _realized_revenue_expression():
    return ExpressionWrapper(
        F('quantity') * F('unit_price'),
        output_field=MONEY_OUTPUT_FIELD,
    )


def _realized_cost_expression():
    return ExpressionWrapper(
        F('quantity') * F('unit_cost'),
        output_field=MONEY_OUTPUT_FIELD,
    )


# â”€â”€ AUTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class RegisterView(generics.CreateAPIView):
    """
    Only admins can create new user accounts.
    Remove IsAdmin here if you want open registration.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response({'detail': 'Only superuser can create users.'}, status=403)
        return super().create(request, *args, **kwargs)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user = User.objects.filter(username=username).first()
        if not user:
            return Response({'detail': 'Incorrect username.'}, status=401)
        if not user.check_password(password):
            return Response({'detail': 'Incorrect password.'}, status=401)
        if not user.is_active:
            return Response({'detail': 'User account is disabled.'}, status=401)

        # Update last_login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


# â”€â”€ CATEGORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class CategoryViewSet(viewsets.ModelViewSet):
    """
    Staff: can list and view categories.
    Admin: full create / edit / delete.
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def _can_manage(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'categories.manage')

    def create(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage categories.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage categories.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage categories.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage categories.'}, status=403)
        instance = self.get_object()
        instance.deleted_by = request.user
        return super().destroy(request, *args, **kwargs)


# â”€â”€ SUPPLIER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class SupplierViewSet(viewsets.ModelViewSet):
    """
    Staff: read-only.
    Admin: full CRUD.
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _can_manage(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'suppliers.manage')

    def create(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage suppliers.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage suppliers.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage suppliers.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to manage suppliers.'}, status=403)
        instance = self.get_object()
        instance.deleted_by = request.user
        return super().destroy(request, *args, **kwargs)


# â”€â”€ PRODUCT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


class VoucherViewSet(viewsets.ModelViewSet):
    queryset = Voucher.objects.all().order_by('-expiry_date')
    serializer_class = VoucherSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.query_params.get('trash') == 'true':
            return Voucher.objects.deleted()
        return super().get_queryset()

    def perform_create(self, serializer):
        if not has_capability(self.request.user, 'vouchers.manage'):
            raise ValidationError("You do not have permission to manage vouchers.")
        serializer.save()

    def perform_update(self, serializer):
        if not has_capability(self.request.user, 'vouchers.manage'):
            raise ValidationError("You do not have permission to manage vouchers.")
        serializer.save()

    def perform_destroy(self, instance):
        if not has_capability(self.request.user, 'vouchers.manage'):
            raise ValidationError("You do not have permission to manage vouchers.")
        instance.delete()

class ProductViewSet(viewsets.ModelViewSet):
    """
    Staff: can view products (needed to create sales).
    Admin: can add / edit / delete products.
    """
    queryset = Product.objects.select_related('category', 'supplier', 'stock').all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Product.objects.select_related('category', 'supplier', 'stock').all()
        user = self.request.user
        if is_operational_admin(user) or has_capability(user, 'products.read') or has_capability(user, 'stock.view') or has_capability(user, 'sales.create') or has_capability(user, 'purchases.manage'):
            return qs
        return Product.objects.none()

    def _can_create(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'products.create')

    def _can_update(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'products.update')

    def _can_delete(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'products.delete')

    def create(self, request, *args, **kwargs):
        if not self._can_create():
            return Response({'detail': 'You do not have permission to create products.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._can_update():
            return Response({'detail': 'You do not have permission to update products.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_update():
            return Response({'detail': 'You do not have permission to update products.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_delete():
            return Response({'detail': 'You do not have permission to delete products.'}, status=403)
        instance = self.get_object()
        instance.deleted_by = request.user
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()


# â”€â”€ PURCHASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class PurchaseViewSet(viewsets.ModelViewSet):
    """
    Only admins can create purchases (stock coming IN).
    Staff can view purchase history.
    """
    queryset = Purchase.objects.select_related('product').order_by('-date', '-id')
    serializer_class = PurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if is_operational_admin(user) or has_capability(user, 'purchases.view') or has_capability(user, 'purchases.manage'):
            return Purchase.objects.select_related('product').order_by('-date', '-id')
        return Purchase.objects.none()

    def _can_manage(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'purchases.manage')

    def create(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to create purchases.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to modify purchases.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to modify purchases.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_manage():
            return Response({'detail': 'You do not have permission to delete purchases.'}, status=403)
        instance = self.get_object()
        instance.deleted_by = request.user
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        with transaction.atomic():
            purchase = serializer.save()
            stock = Stock.objects.select_for_update().get(product=purchase.product)
            stock.quantity += purchase.quantity
            stock.save()
            product = purchase.product
            product.price = purchase.unit_cost
            product.sale_price = purchase.selling_price
            product.full_price = purchase.full_selling_price
            product.discount_percent = purchase.discount_percent
            product.save(update_fields=['price', 'sale_price', 'full_price', 'discount_percent'])

    def perform_update(self, serializer):
        with transaction.atomic():
            previous = Purchase.objects.select_for_update().get(pk=serializer.instance.pk)
            old_product = previous.product
            old_quantity = previous.quantity

            purchase = serializer.save()
            new_product = purchase.product
            new_quantity = purchase.quantity

            if old_product.id == new_product.id:
                stock = Stock.objects.select_for_update().get(product=new_product)
                stock.quantity += (new_quantity - old_quantity)
                stock.save(update_fields=['quantity'])
            else:
                old_stock = Stock.objects.select_for_update().get(product=old_product)
                new_stock = Stock.objects.select_for_update().get(product=new_product)
                old_stock.quantity -= old_quantity
                new_stock.quantity += new_quantity
                old_stock.save(update_fields=['quantity'])
                new_stock.save(update_fields=['quantity'])

            product = new_product
            product.price = purchase.unit_cost
            product.sale_price = purchase.selling_price
            product.full_price = purchase.full_selling_price
            product.discount_percent = purchase.discount_percent
            product.save(update_fields=['price', 'sale_price', 'full_price', 'discount_percent'])


# â”€â”€ SALE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class SaleViewSet(viewsets.ModelViewSet):
    """
    Both admin and staff can create sales.
    Only admins can delete or edit a past sale.
    """
    queryset = Sale.objects.select_related('product').order_by('-date', '-id')
    serializer_class = SaleSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def _can_create(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'sales.create')

    def _can_history(self):
        return is_operational_admin(self.request.user) or has_capability(self.request.user, 'sales.history.view')

    def list(self, request, *args, **kwargs):
        if not self._can_history():
            return Response({'detail': 'You do not have permission to view sales history.'}, status=403)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        if not self._can_history():
            return Response({'detail': 'You do not have permission to view sales history.'}, status=403)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not self._can_create():
            return Response({'detail': 'You do not have permission to create sales.'}, status=403)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        with transaction.atomic():
            data = serializer.validated_data
            stock = Stock.objects.select_for_update().get(product=data['product'])
            if stock.quantity < data['quantity']:
                raise ValidationError(
                    {'detail': f'Insufficient stock. Available: {stock.quantity}'}
                )
            pricing = _compute_sale_unit_pricing(data['product'], data['quantity'], method='average')
            if pricing is None:
                raise ValidationError({'detail': f'Cannot create sale for {data["product"].name} before recording at least one purchase.'})
            unit_cost = pricing.get('unit_cost')
            unit_selling_price = pricing.get('unit_selling_price')
            if not _is_valid_positive(unit_cost):
                raise ValidationError({'detail': f'Computed cost is invalid for {data["product"].name}. Please verify purchase costs.'})
            if not _is_valid_positive(unit_selling_price):
                raise ValidationError({'detail': f'Computed selling price is invalid for {data["product"].name}. Please verify purchase pricing and discounts.'})
            sale = serializer.save(
                unit_price=unit_selling_price,
                unit_cost=unit_cost,
                costing_method='average',
            )
            stock.quantity -= sale.quantity
            stock.save()

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sales_cost_preview(request):
    """
    Preview costing for one sale line without creating a sale.
    Payload: {"product": 1, "quantity": 2, "costing_method": "average"|"fifo"}
    """
    product_id = request.data.get('product')
    quantity = request.data.get('quantity')
    method = str(request.data.get('costing_method') or 'average').strip().lower()

    if not product_id:
        return Response({'detail': 'product is required.'}, status=400)
    if not quantity or int(quantity) <= 0:
        return Response({'detail': 'quantity must be greater than 0.'}, status=400)
    if method not in ('average', 'fifo'):
        return Response({'detail': 'costing_method must be either average or fifo.'}, status=400)

    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return Response({'detail': 'Product not found.'}, status=404)

    stock = Stock.objects.filter(product=product).first()
    available = int(stock.quantity) if stock else 0
    req_qty = int(quantity)
    if available < req_qty:
        return Response({'detail': f'Insufficient stock for preview. Available: {available}.'}, status=400)

    pricing = _compute_sale_unit_pricing(product, req_qty, method=method)
    if pricing is None:
        if method == 'fifo':
            return Response({'detail': f'Cannot apply FIFO pricing for {product.name} with current purchase lots.'}, status=400)
        return Response({'detail': f'Cannot preview pricing for {product.name} before recording at least one purchase.'}, status=400)

    unit_cost = pricing.get('unit_cost')
    unit_selling_price = pricing.get('unit_selling_price')
    if not _is_valid_positive(unit_cost):
        return Response({'detail': f'Computed cost is invalid for {product.name}. Please verify purchase costs.'}, status=400)
    if not _is_valid_positive(unit_selling_price):
        return Response({'detail': f'Computed selling price is invalid for {product.name}. Please verify purchase pricing and discounts.'}, status=400)

    has_cost_variation = _has_cost_or_price_variation(product)
    return Response({
        'product': product.id,
        'quantity': req_qty,
        'costing_method': method,
        'has_cost_variation': has_cost_variation,
        'unit_cost': round(unit_cost, 2),
        'line_cost': round(unit_cost * req_qty, 2),
        'unit_selling_price': round(unit_selling_price, 2),
        'selling_price': round(unit_selling_price, 2),
        'line_revenue': round(unit_selling_price * req_qty, 2),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sales_bulk_create(request):
    """
    Create multiple sale lines atomically.
    Expected payload:
    {
      "customer_name": "...",
      "notes": "...",            # optional shared note
      "voucher_code": "...",      # optional voucher code
      "items": [{"product": 1, "quantity": 2}, ...]
    }
    """
    customer_name = (request.data.get('customer_name') or '').strip()
    shared_notes = request.data.get('notes', '')
    items = request.data.get('items', [])
    voucher_code = request.data.get('voucher_code', '').strip()

    if not customer_name:
        return Response({'detail': 'customer_name is required.'}, status=400)
    if not isinstance(items, list) or not items:
        return Response({'detail': 'items must be a non-empty list.'}, status=400)

    # Pre-calculate subtotal for voucher validation
    subtotal = Decimal('0.00')
    temp_items_data = []
    for item in items:
        product = Product.objects.filter(pk=item.get('product')).first()
        if product:
            quantity = int(item.get('quantity') or 0)
            method = str(item.get('costing_method') or 'average').strip().lower()
            pricing = _compute_sale_unit_pricing(product, quantity, method=method)
            if pricing:
                unit_price = Decimal(str(pricing.get('unit_selling_price')))
                subtotal += unit_price * quantity
                temp_items_data.append({'product': product, 'unit_price': unit_price, 'quantity': quantity, 'pricing': pricing})

    voucher = None
    discount_total = Decimal('0.00')
    if voucher_code:
        voucher = Voucher.objects.filter(code=voucher_code, is_active=True, is_deleted=False).first()
        if not voucher:
            return Response({'detail': 'Invalid or inactive voucher code.'}, status=400)
        
        products_in_cart = [item['product'] for item in temp_items_data]
        is_valid, error_msg = voucher.is_valid_voucher(subtotal, customer_name=customer_name, products_in_cart=products_in_cart)
        if not is_valid:
            return Response({'detail': error_msg}, status=400)
        
        if voucher.voucher_type == 'percentage':
            discount_amount = (subtotal * voucher.discount_value / Decimal('100')).quantize(Decimal('0.01'))
            if voucher.max_discount is not None and discount_amount > voucher.max_discount:
                discount_amount = voucher.max_discount
            discount_total = discount_amount
        else:
            discount_total = min(voucher.discount_value, subtotal)


    created_sales = []
    item_rows = []
    bill_id = f"BILL-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    with transaction.atomic():
        for idx, item in enumerate(items):
            product_id = item.get('product')
            quantity = item.get('quantity')
            if not product_id:
                raise ValidationError({'detail': f'Item #{idx + 1}: product is required.'})
            if not quantity or int(quantity) <= 0:
                raise ValidationError({'detail': f'Item #{idx + 1}: quantity must be greater than 0.'})

            product = Product.objects.filter(pk=product_id).first()
            if not product:
                raise ValidationError({'detail': f'Item #{idx + 1}: product not found.'})

            stock = Stock.objects.select_for_update().get(product=product)
            if stock.quantity < int(quantity):
                raise ValidationError({'detail': f'Insufficient stock for {product.name}. Available: {stock.quantity}'})
            method = str(item.get('costing_method') or 'average').strip().lower()
            if method not in ('average', 'fifo'):
                raise ValidationError({'detail': f'Item #{idx + 1}: costing_method must be either average or fifo.'})

            pricing = _compute_sale_unit_pricing(product, int(quantity), method=method)
            if pricing is None:
                if method == 'fifo':
                    raise ValidationError({'detail': f'Cannot apply FIFO pricing for {product.name}. Ensure purchase history and stock lots are sufficient.'})
                raise ValidationError({'detail': f'Cannot create sale for {product.name} before recording at least one purchase.'})

            unit_cost = pricing.get('unit_cost')
            unit_selling_price = Decimal(str(pricing.get('unit_selling_price')))
            
            # Apply proportional discount
            item_total = unit_selling_price * int(quantity)
            item_discount = Decimal('0.00')
            if subtotal > 0:
                item_discount = (discount_total * item_total / subtotal).quantize(Decimal('0.01'))

            sale = Sale.objects.create(
                product=product,
                bill_id=bill_id,
                customer_name=customer_name,
                quantity=int(quantity),
                unit_price=unit_selling_price,
                unit_cost=unit_cost,
                costing_method=method,
                notes=item.get('notes', shared_notes),
                voucher=voucher,
                discount_amount=item_discount
            )
            stock.quantity -= int(quantity)
            stock.save()
            created_sales.append(sale)
            item_rows.append({
                'product_name': product.name,
                'quantity': int(quantity),
                'unit_selling_price': round(unit_selling_price, 2),
                'selling_price': round(unit_selling_price, 2),
                'unit_cost': round(unit_cost, 2),
                'costing_method': method,
                'total': round(unit_selling_price * int(quantity), 2),
            })

    if voucher:
        voucher.used_count += 1
        voucher.save()

    data = SaleSerializer(created_sales, many=True).data
    return Response({'sales': data, 'count': len(data), 'summary_items': item_rows, 'bill_id': bill_id}, status=201)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sales_selected_invoice(request):
    # Permission check
    if not (is_operational_admin(request.user) or has_capability(request.user, 'sales.history.view') or has_capability(request.user, 'sales.create')):
        return Response({'detail': 'You do not have permission to download sales invoices.'}, status=403)
    
    sale_ids = request.data.get('sale_ids', [])
    if not isinstance(sale_ids, list) or not sale_ids:
        return Response({'detail': 'sale_ids must be a non-empty list.'}, status=400)

    qs = Sale.objects.filter(id__in=sale_ids).order_by('id')
    if not qs.exists():
        return Response({'detail': 'No sales found for the provided IDs.'}, status=404)

    try:
        first = qs.first()
        title = f"Invoice for {first.customer_name}"
        pdf_bytes = _build_invoice_pdf(qs, title=title)
        pdf_64 = base64.b64encode(pdf_bytes).decode('utf-8')
        return Response({'pdf_64': pdf_64, 'filename': 'invoice.pdf'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'detail': f'Failed to generate: {str(e)}'}, status=500)

# â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    is_superuser = request.user.is_superuser
    months_param = request.query_params.get('months')
    try:
        months = int(months_param) if months_param is not None else 6
    except (TypeError, ValueError):
        months = 6
    if months not in (1, 3, 6, 12):
        months = 6

    # Staff and admin both see these
    total_products  = Product.objects.count()
    total_vouchers  = Voucher.objects.count()
    low_stock_items = Stock.objects.filter(
        quantity__lte=models.F('low_stock_threshold')
    ).count()
    low_stock_list  = Stock.objects.select_related('product').filter(
        quantity__lte=models.F('low_stock_threshold')
    ).values('product__name', 'quantity', 'low_stock_threshold')[:5]

    # Base response for everyone
    response_data = {
        'total_products':  total_products,
        'total_vouchers':  total_vouchers,
        'low_stock_items': low_stock_items,
        'low_stock_list':  list(low_stock_list),
        'is_admin':        request.user.role == 'admin' or is_superuser,
        'is_superuser':    is_superuser,
    }

    # Superuser-only financial data
    if is_superuser:
        sale_totals = Sale.objects.aggregate(
            total_revenue=Coalesce(Sum(_realized_revenue_expression(), output_field=MONEY_OUTPUT_FIELD), MONEY_ZERO, output_field=MONEY_OUTPUT_FIELD),
            total_cost=Coalesce(Sum(_realized_cost_expression(), output_field=MONEY_OUTPUT_FIELD), MONEY_ZERO, output_field=MONEY_OUTPUT_FIELD),
            total_sales=Coalesce(Sum('quantity'), 0),
        )
        total_revenue = float(sale_totals.get('total_revenue') or 0)
        total_cost = float(sale_totals.get('total_cost') or 0)
        total_sales = int(sale_totals.get('total_sales') or 0)
        total_purchases = Purchase.objects.aggregate(total=Coalesce(Sum('quantity'), 0))['total']

        monthly_data = []
        now = timezone.now()
        for i in range(months - 1, -1, -1):
            m = now.month - i
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            month_sales = Sale.objects.filter(date__month=m, date__year=y).aggregate(total=Sum('quantity'))['total'] or 0
            monthly_data.append({
                'month': datetime.date(y, m, 1).strftime('%b'),
                'sales': month_sales
            })

        response_data.update({
            'total_sales':     total_sales,
            'total_purchases': total_purchases,
            'total_revenue':   round(total_revenue, 2),
            'total_cost':      round(total_cost, 2),
            'total_profit':    round(total_revenue - total_cost, 2),
            'months_window':   months,
            'monthly_data':    monthly_data,
        })

    return Response(response_data)


# â”€â”€ PROFIT REPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profit_report(request):
    """Only superuser can see the full profit breakdown."""
    if not request.user.is_superuser:
        return Response({'detail': 'You do not have permission to view profit report.'}, status=403)
    products = Product.objects.select_related('category').all()
    sale_totals = {
        row['product_id']: row
        for row in Sale.objects.values('product_id').annotate(
            revenue=Coalesce(Sum(_realized_revenue_expression(), output_field=MONEY_OUTPUT_FIELD), MONEY_ZERO, output_field=MONEY_OUTPUT_FIELD),
            cost=Coalesce(Sum(_realized_cost_expression(), output_field=MONEY_OUTPUT_FIELD), MONEY_ZERO, output_field=MONEY_OUTPUT_FIELD),
            total_sold=Coalesce(Sum('quantity'), 0),
        )
    }
    purchase_totals = {
        row['product_id']: int(row['total_purchased'] or 0)
        for row in Purchase.objects.values('product_id').annotate(
            total_purchased=Coalesce(Sum('quantity'), 0)
        )
    }
    rows = []
    overall_revenue = 0
    overall_cost    = 0

    for product in products:
        totals = sale_totals.get(product.id, {})
        revenue = float(totals.get('revenue') or 0)
        cost = float(totals.get('cost') or 0)

        profit = revenue - cost
        margin = round((profit / revenue) * 100, 1) if revenue > 0 else 0

        total_sold = int(totals.get('total_sold') or 0)
        total_purchased = purchase_totals.get(product.id, 0)

        overall_revenue += revenue
        overall_cost    += cost

        rows.append({
            'id': product.id, 'name': product.name, 'sku': product.sku,
            'category':        product.category.name if product.category else 'â€”',
            'total_sold':      total_sold,
            'total_purchased': total_purchased,
            'revenue': round(revenue, 2), 'cost': round(cost, 2),
            'profit':  round(profit, 2),  'margin': margin,
        })

    rows.sort(key=lambda x: x['profit'], reverse=True)
    overall_profit = overall_revenue - overall_cost
    overall_margin = round((overall_profit / overall_revenue) * 100, 1) if overall_revenue > 0 else 0

    return Response({
        'products': rows,
        'summary': {
            'total_revenue': round(overall_revenue, 2),
            'total_cost':    round(overall_cost, 2),
            'total_profit':  round(overall_profit, 2),
            'margin':        overall_margin,
        }
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    """Returns the logged-in user's id, username, and role."""
    can_manage_users = request.user.is_superuser
    effective_permissions = request.user.get_effective_permissions()
    return Response({
        'id':       request.user.id,
        'username': request.user.username,
        'role':     request.user.role,
        'is_superuser': request.user.is_superuser,
        'can_manage_users': can_manage_users,
        'permissions': effective_permissions,
        'available_staff_permissions': list(User.normalize_permissions(User.STAFF_ASSIGNABLE_PERMISSIONS)),
        'default_staff_permissions': list(User.normalize_permissions(User.STAFF_DEFAULT_PERMISSIONS)),
        'available_admin_permissions': list(User.normalize_permissions(User.ADMIN_ASSIGNABLE_PERMISSIONS)),
        'default_admin_permissions': list(User.normalize_permissions(User.ADMIN_DEFAULT_PERMISSIONS)),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Allow any authenticated user to change their own password."""
    current_password = request.data.get('current_password') or ''
    new_password = request.data.get('new_password') or ''
    confirm_password = request.data.get('confirm_password') or ''

    if not current_password:
        return Response({'detail': 'Current password is required.'}, status=400)
    if not new_password:
        return Response({'detail': 'New password is required.'}, status=400)
    if new_password != confirm_password:
        return Response({'detail': 'New password and confirm password do not match.'}, status=400)
    if not request.user.check_password(current_password):
        return Response({'detail': 'Current password is incorrect.'}, status=400)

    try:
        validate_password(new_password, request.user)
    except DjangoValidationError as exc:
        return Response({'detail': ' '.join(exc.messages)}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    return Response({'detail': 'Password changed successfully. Please log in again.'})

# ==============================================================================
# USER MANAGEMENT  (admin only)
# ==============================================================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    """Only superuser can list users for management."""
    if not request.user.is_superuser:
        return Response({'detail': 'Only superuser can manage users.'}, status=403)
    users = User.objects.all().order_by('-date_joined', '-id')

    data = [
        {
            'id':          u.id,
            'username':    u.username,
            'email':       u.email,
            'role':        u.role,
            'is_active':   u.is_active,
            'is_superuser': u.is_superuser,
            'permissions': u.get_effective_permissions(),
            'staff_permissions': u._deserialize_staff_permissions(),
            'date_joined': u.date_joined,
            'last_login':  u.last_login,
        }
        for u in users
    ]
    return Response(data)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_user(request, user_id):
    """Superuser can update role/is_active/password and staff permissions."""
    if not request.user.is_superuser:
        return Response({'detail': 'Only superuser can update users.'}, status=403)

    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    # Prevent editing superusers other than self
    if target.is_superuser and target.id != request.user.id:
        return Response({'detail': 'Cannot modify a superuser.'}, status=403)

    # Only allow changing role and is_active
    allowed = ['role', 'is_active']
    for field in allowed:
        if field in request.data:
            setattr(target, field, request.data[field])

    if 'staff_permissions' in request.data:
        target.set_staff_permissions(request.data.get('staff_permissions') or [])

    # Handle password change if provided
    new_password = request.data.get('password')
    if new_password:
        target.set_password(new_password)

    target.save()
    return Response({
        'id':        target.id,
        'username':  target.username,
        'email':     target.email,
        'role':      target.role,
        'is_active': target.is_active,
        'permissions': target.get_effective_permissions(),
    })


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_user(request, user_id):
    """Superuser can delete users. Cannot delete superusers or yourself."""
    if not request.user.is_superuser:
        return Response({'detail': 'Only superuser can delete users.'}, status=403)

    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    if target.is_superuser:
        return Response({'detail': 'Cannot delete a superuser.'}, status=403)

    if target.id == request.user.id:
        return Response({'detail': 'You cannot delete your own account.'}, status=403)
    
    target.deleted_by = request.user
    target.delete()
    return Response({'detail': 'User deleted successfully.'})


# â”€â”€ AUDIT LOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only read-only view of all audit log entries."""
    serializer_class   = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not (is_operational_admin(self.request.user) or has_capability(self.request.user, 'audit.view')):
            return AuditLog.objects.none()
        qs = AuditLog.objects.select_related('user').all()
        action     = self.request.query_params.get('action')
        model_name = self.request.query_params.get('model_name')
        username   = self.request.query_params.get('username')
        if action:
            qs = qs.filter(action=action)
        if model_name:
            qs = qs.filter(model_name=model_name)
        if username:
            qs = qs.filter(user__username__icontains=username)
        return qs


# â”€â”€ PDF INVOICE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _build_invoice_pdf(sales_qs, title="Invoice"):
    """Build a clean ReportLab PDF for the given Sale queryset. Returns bytes."""
    import traceback
    try:
        print(f"[PDF] Starting generation for title: {title}")
        buffer = io.BytesIO()

        # A4 = 595.28 x 841.89 pt.  Margins 1.8cm each side â†’ usable = 595.28 - 2*51 = 493pt
        L_MARGIN = R_MARGIN = 1.8 * cm
        USABLE = 595.28 - L_MARGIN - R_MARGIN   # â‰ˆ 493 pt

        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=L_MARGIN, rightMargin=R_MARGIN,
            topMargin=2 * cm, bottomMargin=2 * cm,
        )

        # â”€â”€ Paragraph styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # Use a single Paragraph with inline XML for the company header so the two
        # lines can never overlap â€” leading is explicit and controls line spacing.
        hdr_style  = ParagraphStyle('hdr',   fontName='Helvetica', leading=36,
                                    spaceAfter=6)
        ttl_style  = ParagraphStyle('ttl',   fontSize=14, fontName='Helvetica-Bold',
                                    textColor=colors.HexColor('#1e40af'),
                                    leading=20, spaceAfter=4)
        gen_style  = ParagraphStyle('gen',   fontSize=8,  fontName='Helvetica',
                                    textColor=colors.HexColor('#64748b'),
                                    leading=12, spaceAfter=0)
        cell_style = ParagraphStyle('cell',  fontSize=8,  fontName='Helvetica',
                                    textColor=colors.HexColor('#0f172a'), leading=11)
        foot_style = ParagraphStyle('foot',  fontSize=8,  fontName='Helvetica',
                                    textColor=colors.HexColor('#94a3b8'),
                                    leading=12, alignment=TA_CENTER)
        story = []

        # --- Header ---
        story.append(Paragraph(
            '<font name="Helvetica-Bold" size="22" color="#0f172a">InvMS</font><br/>'
            '<font name="Helvetica" size="10" color="#64748b">Inventory Management System</font>',
            hdr_style))
        story.append(HRFlowable(width="100%", thickness=2,
                                 color=colors.HexColor("#1e293b"),
                                 spaceBefore=4, spaceAfter=8))
        story.append(Paragraph(escape(title), ttl_style))
        story.append(Paragraph(
            f'Generated: {datetime.datetime.now().strftime("%d %b %Y  %I:%M %p")}',
            gen_style))
        story.append(Spacer(1, 0.5 * cm))

        sales = list(sales_qs.select_related("product", "voucher"))
        customer_label = sales[0].customer_name if sales else "-"
        bill_label = sales[0].bill_id if sales and sales[0].bill_id else f'SINGLE-{sales[0].id}' if sales else "-"
        story.append(Paragraph(f'Customer: <b>{escape(customer_label)}</b>', gen_style))
        story.append(Paragraph(f'Bill ID: <b>{escape(bill_label)}</b>', gen_style))

        # Display voucher information if applicable
        if sales and sales[0].voucher:
            voucher = sales[0].voucher
            v_type_disp = "Percentage" if voucher.voucher_type == "percentage" else "Fixed Amount"
            story.append(Paragraph(
                f'<font color="#10b981">✓ Voucher Applied: <b>{escape(voucher.code)}</b> ({v_type_disp})</font>',
                gen_style
            ))

        story.append(Spacer(1, 0.25 * cm))

        # --- Table ---
        col_w = [24, 65, 160, 32, 60, 72, 80]
        hdr = ["#", "Date", "Product", "Qty", "Unit Price\n(Rs.)", "Voucher Disc.\n(Rs.)", "Line Total\n(Rs.)"]
        rows = [hdr]
        grand_subtotal = 0.0
        total_voucher_discount = 0.0

        for i, s in enumerate(sales, start=1):
            qty = float(s.quantity)
            u_price = float(s.unit_price)
            v_discount = float(s.discount_amount or 0)
            
            line_subtotal = qty * u_price
            line_final = line_subtotal - v_discount
            
            grand_subtotal += line_subtotal
            total_voucher_discount += v_discount

            full_u_price = float(getattr(s.product, "full_price", 0) or 0)
            if full_u_price > u_price:
                u_price_html = f'<font color="#94a3b8"><strike>{full_u_price:,.2f}</strike></font><br/><font color="#15803d"><b>{u_price:,.2f}</b></font>'
            else:
                u_price_html = f'{u_price:,.2f}'

            v_disc_html = f'<font color="#ef4444">-{v_discount:,.2f}</font>' if v_discount > 0 else "—"

            rows.append([
                str(i),
                s.date.strftime("%d %b\n%Y"),
                Paragraph(escape(s.product.name), cell_style),
                str(int(qty)),
                Paragraph(u_price_html, cell_style),
                Paragraph(v_disc_html, cell_style),
                f'{line_final:,.2f}',
            ])

        if total_voucher_discount > 0:
            rows.append(["", "", "SUBTOTAL", "", "", "", f'{grand_subtotal:,.2f}'])
            v_code = sales[0].voucher.code if sales and sales[0].voucher else "Voucher"
            rows.append(["", "", f'DISCOUNT ({v_code})', "", "", "", f'-{total_voucher_discount:,.2f}'])

        final_total = grand_subtotal - total_voucher_discount
        rows.append(["", "", "GRAND TOTAL", "", "", "", f'Rs. {final_total:,.2f}'])

        tbl = Table(rows, colWidths=col_w, repeatRows=1)

        # Build alternating-row backgrounds manually
        style_cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#1e293b")),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0),  8),
            ("TOPPADDING",    (0, 0), (-1, 0),  8),
            ("BOTTOMPADDING", (0, 0), (-1, 0),  8),
            ("LEFTPADDING",   (0, 0), (-1, 0),  5),
            ("RIGHTPADDING",  (0, 0), (-1, 0),  5),
            ("FONTNAME",      (0, 1), (-1, -2), "Helvetica"),
            ("FONTSIZE",      (0, 1), (-1, -2), 8),
            ("TOPPADDING",    (0, 1), (-1, -2), 6),
            ("BOTTOMPADDING", (0, 1), (-1, -2), 6),
            ("LEFTPADDING",   (0, 1), (-1, -2), 5),
            ("RIGHTPADDING",  (0, 1), (-1, -2), 5),
            ("GRID",          (0, 0), (-1, -2), 0.4, colors.HexColor("#e2e8f0")),
            ("BACKGROUND",    (0, -1), (-1, -1), colors.HexColor("#f0fdf4")),
            ("FONTNAME",      (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE",      (0, -1), (-1, -1), 9),
            ("TOPPADDING",    (0, -1), (-1, -1), 9),
            ("BOTTOMPADDING", (0, -1), (-1, -1), 9),
            ("LEFTPADDING",   (0, -1), (-1, -1), 5),
            ("RIGHTPADDING",  (0, -1), (-1, -1), 5),
            ("TEXTCOLOR",     (-1, -1), (-1, -1), colors.HexColor("#15803d")),
            ("LINEABOVE",     (0, -1), (-1, -1), 1.5, colors.HexColor("#16a34a")),
            ("ALIGN",  (0, 0),  (0, -1),  "CENTER"),
            ("ALIGN",  (3, 0),  (-1, -1), "RIGHT"),
            ("ALIGN",  (2, -1), (2, -1),  "RIGHT"),
            ("VALIGN", (0, 0),  (-1, -1), "MIDDLE"),
        ]

        for row_idx in range(1, len(rows) - 1):
            if row_idx % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#f8fafc")))

        tbl.setStyle(TableStyle(style_cmds))
        story.append(tbl)
        story.append(Spacer(1, 0.8 * cm))

        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph("Thank you for your business  |  InvMS Inventory Management System", foot_style))

        doc.build(story)
        return buffer.getvalue()
    except Exception as e:
        print(f"[PDF ERROR] {e}")
        import traceback
        traceback.print_exc()
        raise

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def sale_invoice(request, pk):
    if not (is_operational_admin(request.user) or has_capability(request.user, 'sales.history.view') or has_capability(request.user, 'sales.create')):
        return Response({'detail': 'You do not have permission to download sales invoices.'}, status=403)

    sale = Sale.objects.filter(pk=pk).first()
    if not sale:
        return Response({'detail': 'Sale not found.'}, status=404)

    if sale.bill_id:
        qs = Sale.objects.filter(bill_id=sale.bill_id).order_by('id')
        invoice_key = sale.bill_id
    else:
        qs = Sale.objects.filter(pk=sale.pk)
        invoice_key = f'sale_{sale.pk}'

    title = f"Invoice for {sale.customer_name}"
    pdf_bytes = _build_invoice_pdf(qs, title=title)
    filename = f"invoice_{invoice_key}.pdf"

    response = HttpResponse(pdf_bytes, content_type='application/octet-stream')
    response['Content-Disposition'] = f'inline; filename="{filename}.bin"'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Credentials'] = 'true'
    return response


# â”€â”€ BULK INVOICE (DATE RANGE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def bulk_invoice(request):
    """Download a PDF invoice for all sales in a date range.
    Query params: start=YYYY-MM-DD  end=YYYY-MM-DD
    """
    if not (is_operational_admin(request.user) or has_capability(request.user, 'sales.history.view') or has_capability(request.user, 'sales.create')):
        return Response({'detail': 'You do not have permission to download bulk sales invoices.'}, status=403)
    start_str = request.query_params.get('start')
    end_str   = request.query_params.get('end')

    qs = Sale.objects.all()
    label_parts = []
    if start_str:
        qs = qs.filter(date__date__gte=start_str)
        label_parts.append(f"From {start_str}")
    if end_str:
        qs = qs.filter(date__date__lte=end_str)
        label_parts.append(f"To {end_str}")

    title = "Bulk Invoice â€” " + ("  ".join(label_parts) if label_parts else "All Sales")

    if not qs.exists():
        return Response({'detail': 'No sales found for the given date range.'}, status=404)

    pdf_bytes = _build_invoice_pdf(qs, title=title)
    filename  = f"invoice_bulk_{start_str or 'all'}_{end_str or 'all'}.pdf"
    response  = HttpResponse(pdf_bytes, content_type='application/octet-stream')
    response['Content-Disposition'] = f'inline; filename="{filename}.bin"'
    # Add CORS headers explicitly for file downloads
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Credentials'] = 'true'
    return response


# â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class NotificationViewSet(viewsets.ViewSet):
    """
    list        GET  /notifications/          â€” current user's notifications
    unread_count GET /notifications/unread-count/ â€” badge count
    mark_read   POST /notifications/{id}/mark-read/
    mark_all    POST /notifications/mark-all-read/
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        qs = Notification.objects.filter(user=request.user).order_by('-created_at')[:50]
        return Response(NotificationSerializer(qs, many=True).data)

    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    def mark_read(self, request, pk=None):
        updated = Notification.objects.filter(pk=pk, user=request.user).update(is_read=True)
        if not updated:
            return Response({'detail': 'Not found.'}, status=404)
        return Response({'status': 'ok'})

    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_all_product_thresholds(request):
    """Set the same low stock threshold value for all product stock records."""
    if not (is_operational_admin(request.user) or has_capability(request.user, 'products.update')):
        return Response({'detail': 'You do not have permission to update product thresholds.'}, status=403)

    threshold = request.data.get('threshold')
    try:
        threshold = int(threshold)
    except (TypeError, ValueError):
        return Response({'detail': 'threshold must be an integer.'}, status=400)

    if threshold < 0:
        return Response({'detail': 'threshold cannot be negative.'}, status=400)

    updated = Stock.objects.update(low_stock_threshold=threshold)
    return Response({'updated_count': updated, 'threshold': threshold})


# â”€â”€ LOW STOCK LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def low_stock_list(request):
    """Return all products whose stock quantity is at or below their threshold."""
    if not (is_operational_admin(request.user) or has_capability(request.user, 'stock.view')):
        return Response({'detail': 'You do not have permission to view stock.'}, status=403)
    low = Stock.objects.filter(
        quantity__lte=models.F('low_stock_threshold')
    ).select_related('product__category', 'product__supplier').order_by('quantity')
    data = []
    for s in low:
        data.append({
            'id':            s.product.id,
            'name':          s.product.name,
            'sku':           s.product.sku,
            'quantity':      s.quantity,
            'threshold':     s.low_stock_threshold,
            'category':      s.product.category.name if s.product.category else None,
            'supplier':      s.product.supplier.name if s.product.supplier else None,
            'supplier_email': s.product.supplier.email if s.product.supplier else None,
        })
    return Response(data)


# â”€â”€ PRODUCT SCAN (barcode / QR lookup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def product_scan(request):
    """
    Look up a product by scanning its barcode (SKU) or QR code (JSON).
    GET /products/scan/?q=<value>
      - Barcode: q = "SKU-123"  (plain SKU string)
      - QR code: q = '{"sku":"SKU-123","id":5}'  (compact JSON)
    Returns full ProductSerializer data or 404.
    """
    # Check permissions first
    if not (
        is_operational_admin(request.user)
        or has_capability(request.user, 'sales.create')
        or has_capability(request.user, 'purchases.manage')
        or has_capability(request.user, 'products.read')
        or has_capability(request.user, 'stock.view')
    ):
        return Response({'detail': 'You do not have permission to scan products.'}, status=403)
    
    import json as _json
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'detail': 'Query parameter "q" is required.'}, status=400)

    product = None
    # Try QR JSON first
    try:
        data = _json.loads(q)
        pid  = data.get('id')
        sku  = data.get('sku', '')
        if pid:
            product = Product.objects.filter(pk=pid).select_related('stock', 'category', 'supplier').first()
        if not product and sku:
            product = Product.objects.filter(sku=sku).select_related('stock', 'category', 'supplier').first()
    except (_json.JSONDecodeError, ValueError):
        product = Product.objects.filter(sku=q).select_related('stock', 'category', 'supplier').first()

    if not product:
        return Response({'detail': f'No product found for "{q}".'}, status=404)

    return Response(ProductSerializer(product, context={'request': request}).data)


# â”€â”€ TRASH / RECOVERY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def trash_list(request):
    """List all deleted items (requires trash.access permission)."""
    if not has_capability(request.user, 'trash.access'):
        return Response({'detail': 'You do not have permission to access trash.'}, status=403)
    
    deleted_items = []
    
    # Products
    for p in Product.objects.deleted().values('id', 'name', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': p['id'],
            'type': 'Product',
            'name': p['name'],
            'deleted_at': p['deleted_at'],
            'deleted_by': p['deleted_by__username'] or 'â€”',
        })
    
    # Categories
    for c in Category.objects.deleted().values('id', 'name', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': c['id'],
            'type': 'Category',
            'name': c['name'],
            'deleted_at': c['deleted_at'],
            'deleted_by': c['deleted_by__username'] or 'â€”',
        })
    
    # Suppliers
    for s in Supplier.objects.deleted().values('id', 'name', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': s['id'],
            'type': 'Supplier',
            'name': s['name'],
            'deleted_at': s['deleted_at'],
            'deleted_by': s['deleted_by__username'] or 'â€”',
        })
    
    # Purchases
    for pu in Purchase.objects.deleted().select_related('product').values('id', 'product__name', 'quantity', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': pu['id'],
            'type': 'Purchase',
            'name': f"{pu['product__name']} (Qty: {pu['quantity']})",
            'deleted_at': pu['deleted_at'],
            'deleted_by': pu['deleted_by__username'] or 'â€”',
        })
    
    # Sales
    for sa in Sale.objects.deleted().select_related('product').values('id', 'product__name', 'customer_name', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': sa['id'],
            'type': 'Sale',
            'name': f"{sa['product__name']} - {sa['customer_name']}",
            'deleted_at': sa['deleted_at'],
            'deleted_by': sa['deleted_by__username'] or 'â€”',
        })
    
    # Users
    for u in User.objects.deleted().values('id', 'username', 'deleted_at', 'deleted_by__username'):
        deleted_items.append({
            'id': u['id'],
            'type': 'User',
            'name': u['username'],
            'deleted_at': u['deleted_at'],
            'deleted_by': u['deleted_by__username'] or 'â€”',
        })
    
    # Sort by deleted_at (newest first)
    deleted_items.sort(key=lambda x: x['deleted_at'] if x['deleted_at'] else timezone.now(), reverse=True)
    
    return Response({'items': deleted_items})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def restore_item(request):
    """Restore a deleted item (requires trash.access permission)."""
    if not has_capability(request.user, 'trash.access'):
        return Response({'detail': 'You do not have permission to restore items.'}, status=403)
    
    item_type = request.data.get('type')
    item_id = request.data.get('id')
    
    if not item_type or not item_id:
        return Response({'detail': 'Missing type or id.'}, status=400)
    
    model_map = {
        'Product': Product,
        'Category': Category,
        'Supplier': Supplier,
        'Purchase': Purchase,
        'Sale': Sale,
        'User': User,
    }
    
    model = model_map.get(item_type)
    if not model:
        return Response({'detail': 'Invalid item type.'}, status=400)
    
    try:
        item = model.objects.deleted().get(id=item_id)
        item.restore()
        return Response({'detail': f'{item_type} restored successfully.'})
    except model.DoesNotExist:
        return Response({'detail': 'Item not found in trash.'}, status=404)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def permanent_delete_item(request):
    """Permanently delete item from trash (superuser only)."""
    if not request.user.is_superuser:
        return Response({'detail': 'Only superuser can permanently delete items.'}, status=403)
    
    item_type = request.data.get('type')
    item_id = request.data.get('id')
    
    if not item_type or not item_id:
        return Response({'detail': 'Missing type or id.'}, status=400)
    
    model_map = {
        'Product': Product,
        'Category': Category,
        'Supplier': Supplier,
        'Purchase': Purchase,
        'Sale': Sale,
        'User': User,
    }
    
    model = model_map.get(item_type)
    if not model:
        return Response({'detail': 'Invalid item type.'}, status=400)
    
    try:
        item = model.objects.deleted().get(id=item_id)
        item.hard_delete()
        return Response({'detail': f'{item_type} permanently deleted.'})
    except model.DoesNotExist:
        return Response({'detail': 'Item not found in trash.'}, status=404)