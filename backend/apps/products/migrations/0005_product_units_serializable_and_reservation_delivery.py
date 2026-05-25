from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _get_existing_columns(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        return {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }


def add_missing_inventory_columns(apps, schema_editor):
    vendor = schema_editor.connection.vendor

    if vendor == 'postgresql':
        statements = [
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS unidad VARCHAR(20) NOT NULL DEFAULT 'UNIDAD';",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_serializable BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE stock_reservations ADD COLUMN IF NOT EXISTS entregado_el TIMESTAMPTZ NULL;",
            "ALTER TABLE stock_reservations ADD COLUMN IF NOT EXISTS entregado_por_id BIGINT NULL;",
        ]
        for statement in statements:
            schema_editor.execute(statement)
        return

    table_operations = {
        'products': [
            ('unidad', "ALTER TABLE products ADD COLUMN unidad VARCHAR(20) NOT NULL DEFAULT 'UNIDAD';"),
            ('is_serializable', "ALTER TABLE products ADD COLUMN is_serializable BOOLEAN NOT NULL DEFAULT FALSE;"),
        ],
        'stock_reservations': [
            ('entregado_el', "ALTER TABLE stock_reservations ADD COLUMN entregado_el DATETIME NULL;"),
            ('entregado_por_id', "ALTER TABLE stock_reservations ADD COLUMN entregado_por_id BIGINT NULL;"),
        ],
    }

    for table_name, operations in table_operations.items():
        existing_columns = _get_existing_columns(schema_editor, table_name)
        for column_name, sql in operations:
            if column_name not in existing_columns:
                schema_editor.execute(sql)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_productsupplier_supplier_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_missing_inventory_columns, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='is_serializable',
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name='product',
                    name='unidad',
                    field=models.CharField(
                        choices=[
                            ('UNIDAD', 'Unidad'),
                            ('METRO', 'Metro'),
                            ('LITRO', 'Litro'),
                            ('PAR', 'Par'),
                            ('CAJA', 'Caja'),
                        ],
                        default='UNIDAD',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='stockreservation',
                    name='entregado_el',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='stockreservation',
                    name='entregado_por',
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='delivered_stock_reservations',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
