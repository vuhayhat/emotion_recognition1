from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('detect_emotion/', views.detect_emotion, name='detect_emotion'),
    path('health_check/', views.health_check, name='health_check'),
] 