from rest_framework.views import exception_handler
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            exc = DRFValidationError(detail=exc.message_dict)
        elif hasattr(exc, 'messages'):
            exc = DRFValidationError(detail={'detail': exc.messages[0] if len(exc.messages) == 1 else exc.messages})
        else:
            exc = DRFValidationError(detail={'detail': str(exc)})

    response = exception_handler(exc, context)

    return response