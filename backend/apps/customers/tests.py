from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer, Device


class CustomerFlowTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_role(
            'recep_customer',
            'Recepcionista',
            [
                'customers.create',
                'customers.edit',
                'customers.view_detail',
                'customers.view_list',
                'devices.create',
                'devices.view_list',
            ],
        )
        self.client.force_authenticate(self.user)

    def test_accepts_valid_persona_identifier(self):
        response = self.client.post(
            '/api/customers/',
            {
                'tipo_cliente': 'PERSONA',
                'identificador': '12345678',
                'nombre': 'Cliente Persona',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_accepts_valid_empresa_identifier(self):
        response = self.client.post(
            '/api/customers/',
            {
                'tipo_cliente': 'EMPRESA',
                'identificador': '12345678901',
                'nombre': 'Cliente Empresa',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rejects_invalid_dni_length(self):
        response = self.client.post(
            '/api/customers/',
            {
                'tipo_cliente': 'PERSONA',
                'identificador': '1234567',
                'nombre': 'Cliente Inválido',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('8 dígitos', str(response.data))

    def test_rejects_invalid_ruc_length(self):
        response = self.client.post(
            '/api/customers/',
            {
                'tipo_cliente': 'EMPRESA',
                'identificador': '1234567890',
                'nombre': 'Empresa Inválida',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('11 dígitos', str(response.data))

    def test_database_constraint_allows_same_identifier_for_different_types(self):
        Customer.objects.create(
            tipo_cliente='PERSONA',
            identificador='11111111111',
            nombre='Persona Base',
        )

        try:
            Customer.objects.create(
                tipo_cliente='EMPRESA',
                identificador='11111111111',
                nombre='Empresa Base',
            )
        except IntegrityError as exc:
            self.fail(f'La unicidad por tipo_cliente + identificador no debería fallar: {exc}')

    def test_duplicate_device_returns_friendly_error(self):
        customer = Customer.objects.create(
            tipo_cliente='PERSONA',
            identificador='87654321',
            nombre='Cliente Equipo',
        )
        Device.objects.create(
            customer=customer,
            tipo_equipo='Laptop',
            marca='Dell',
            modelo='Latitude 5420',
            numero_serie='SER-001',
        )

        response = self.client.post(
            f'/api/customers/{customer.id}/devices/',
            {
                'tipo_equipo': 'Laptop',
                'marca': 'Dell',
                'modelo': 'Latitude 5420',
                'numero_serie': 'SER-001',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ya está registrado', str(response.data))
