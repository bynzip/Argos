from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='customer',
            name='unique_active_customer_identifier',
        ),
        migrations.AddConstraint(
            model_name='customer',
            constraint=models.UniqueConstraint(
                condition=models.Q(('deleted_at__isnull', True)),
                fields=('tipo_cliente', 'identificador'),
                name='unique_active_customer_identifier_per_type',
            ),
        ),
    ]
