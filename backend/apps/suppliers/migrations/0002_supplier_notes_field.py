from django.db import migrations, models


def add_supplier_notes_column(apps, schema_editor):
    vendor = schema_editor.connection.vendor

    if vendor == 'postgresql':
        schema_editor.execute(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notas TEXT NOT NULL DEFAULT '';"
        )
        return

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(cursor, 'suppliers')
        }

    if 'notas' not in existing_columns:
        schema_editor.execute("ALTER TABLE suppliers ADD COLUMN notas TEXT NOT NULL DEFAULT '';")


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_supplier_notes_column, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='supplier',
                    name='notas',
                    field=models.TextField(blank=True, default=''),
                ),
            ],
        ),
    ]
