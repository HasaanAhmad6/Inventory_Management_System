from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, FloatField, Sum
from django.db.models.functions import Coalesce

from inventory.models import Sale


class Command(BaseCommand):
    help = "Backfill Sale.unit_cost where it is zero using weighted average purchase cost for each product."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without saving updates.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        target_sales = Sale.objects.filter(unit_cost=0).select_related("product")
        total = target_sales.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No sales with unit_cost=0 found."))
            return

        updated = 0
        skipped = 0
        with transaction.atomic():
            for sale in target_sales:
                stats = sale.product.purchases.aggregate(
                    total_qty=Coalesce(Sum("quantity"), 0),
                    total_cost=Coalesce(Sum(F("quantity") * F("unit_cost"), output_field=FloatField()), 0.0),
                )
                total_qty = float(stats.get("total_qty") or 0)
                if total_qty <= 0:
                    skipped += 1
                    continue

                unit_cost = float(stats.get("total_cost") or 0.0) / total_qty
                if unit_cost <= 0:
                    skipped += 1
                    continue

                updated += 1
                if not dry_run:
                    sale.unit_cost = round(unit_cost, 2)
                    if not sale.costing_method:
                        sale.costing_method = "average"
                    sale.save(update_fields=["unit_cost", "costing_method"])

            if dry_run:
                transaction.set_rollback(True)

        mode = "Dry run" if dry_run else "Done"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode}: total={total}, updated={updated}, skipped={skipped}"
            )
        )
