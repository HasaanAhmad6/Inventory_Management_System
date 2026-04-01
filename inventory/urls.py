from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    LoginView,
    ProductViewSet,
    CategoryViewSet,
    SupplierViewSet,
    VoucherViewSet,
    PurchaseViewSet,
    SaleViewSet,
    AuditLogViewSet,
    NotificationViewSet,
    dashboard_summary,
    profit_report,
    me,
    change_password,
    users_list,
    update_user,
    delete_user,
    sale_invoice,
    bulk_invoice,
    sales_bulk_create,
    sales_cost_preview,
    sales_selected_invoice,
    set_all_product_thresholds,
    low_stock_list,
    product_scan,
    trash_list,
    restore_item,
    permanent_delete_item,
)

router = DefaultRouter()
router.register(r'products',   ProductViewSet,  basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'suppliers',  SupplierViewSet, basename='supplier')
router.register(r'vouchers',   VoucherViewSet,  basename='voucher')
router.register(r'purchases',  PurchaseViewSet, basename='purchase')
router.register(r'sales',      SaleViewSet,     basename='sale')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(),        name='register'),
    path('auth/login/',    LoginView.as_view(),           name='login'),
    path('auth/refresh/',  TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/me/',       me,                            name='me'),
    path('auth/change-password/', change_password,        name='change_password'),

    path('auth/users/',              users_list,   name='users_list'),
    path('auth/users/<int:user_id>/update/', update_user,  name='update_user'),
    path('auth/users/<int:user_id>/delete/', delete_user,  name='delete_user'),

    path('dashboard/', dashboard_summary, name='dashboard'),
    path('profits/',   profit_report,     name='profits'),

    path('sales/<int:pk>/invoice/', sale_invoice, name='sale_invoice'),
    path('sales/invoice-bulk/',     bulk_invoice, name='bulk_invoice'),
    path('sales/cost-preview/',     sales_cost_preview, name='sales_cost_preview'),
    path('sales/bulk-create/',      sales_bulk_create, name='sales_bulk_create'),
    path('sales/invoice-selected/', sales_selected_invoice, name='sales_selected_invoice'),

    # Low stock + notifications
    path('low-stock/', low_stock_list, name='low_stock_list'),
    path('low-stock/set-threshold-all/', set_all_product_thresholds, name='set_all_product_thresholds'),
    path('products/scan/', product_scan, name='product_scan'),
    path('notifications/',             NotificationViewSet.as_view({'get': 'list'}),             name='notifications'),
    path('notifications/unread-count/', NotificationViewSet.as_view({'get': 'unread_count'}),    name='notifications_unread'),
    path('notifications/mark-all-read/', NotificationViewSet.as_view({'post': 'mark_all_read'}), name='notifications_mark_all'),
    path('notifications/<int:pk>/mark-read/', NotificationViewSet.as_view({'post': 'mark_read'}), name='notification_mark_read'),

    # Trash / Recovery
    path('trash/', trash_list, name='trash_list'),
    path('trash/restore/', restore_item, name='restore_item'),
    path('trash/permanent/', permanent_delete_item, name='permanent_delete'),

    path('', include(router.urls)),
]
