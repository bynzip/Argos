from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.users.views import CustomTokenObtainPairView, CustomTokenRefreshView, LogoutView, UserMeView

urlpatterns = [
    # Root redirect to Admin
    path('', lambda request: redirect('admin/', permanent=False)),
    
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # Auth Endpoints
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='token_logout'),
    path('api/auth/me/', UserMeView.as_view(), name='user_me'),
    
    # Local Apps Endpoints
    path('api/users/', include('apps.users.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/quotes/', include('apps.quotes.urls')),
    path('api/finance/', include('apps.finance.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
