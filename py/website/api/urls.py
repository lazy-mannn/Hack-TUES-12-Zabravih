from django.urls import path

from . import views

urlpatterns = [
    path('', views.hive_list, name='hive-list'),
    path('<int:pk>/', views.hive_detail, name='hive-detail'),
    path('register/', views.register_hive, name='register-hive'),
]
