from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import User
from .serializers import UserSerializer

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Users.
    Includes an endpoint for the currently logged-in user.
    """
    queryset = User.objects.all().select_related('subarea', 'subarea__area')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='staff')
    def staff(self, request):
        """Returns users with is_staff=True, typically técnicos/recepcionistas"""
        staff_users = self.get_queryset().filter(is_staff=True, is_active=True)
        serializer = self.get_serializer(staff_users, many=True)
        return Response(serializer.data)
