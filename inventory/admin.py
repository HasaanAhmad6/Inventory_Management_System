from django.contrib import admin
from .models import Product, Category, Supplier, Stock, Purchase, Sale, AuditLog, Notification

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'category', 'supplier', 'price']
    search_fields = ['name', 'sku']
    list_filter = ['category', 'supplier']

admin.site.register(Category)
admin.site.register(Supplier)
admin.site.register(Stock)
admin.site.register(Purchase)
admin.site.register(Sale)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display  = ['timestamp', 'user', 'action', 'model_name', 'object_id', 'object_repr']
    list_filter   = ['action', 'model_name']
    search_fields = ['user__username', 'object_repr']
    readonly_fields = ['timestamp', 'user', 'action', 'model_name', 'object_id', 'object_repr']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['created_at', 'user', 'title', 'is_read', 'product']
    list_filter   = ['is_read']
    search_fields = ['user__username', 'title']
    readonly_fields = ['created_at', 'user', 'title', 'message', 'product']
