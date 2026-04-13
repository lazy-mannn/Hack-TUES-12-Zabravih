from django.urls import path

from .views import hive_detail, hive_list, register_hive, edit_hive, get_measurement

urlpatterns = [
    path('', hive_list, name='hive-list'),
    path('<int:pk>/', hive_detail, name='hive-detail'),
    path('<int:pk>/edit/', edit_hive, name='edit-hive'),
    path('register/', register_hive, name='register-hive'),
    path('measurements/', get_measurement, name='get-measurement'),
]
