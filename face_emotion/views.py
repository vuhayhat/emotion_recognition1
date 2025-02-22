from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import cv2
import numpy as np
from PIL import Image
import io
import base64
import json
import logging
import os
from deepface import DeepFace

# Thiết lập logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import DeepFace với xử lý lỗi
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError as e:
    logger.error(f"DeepFace import error: {str(e)}")
    DEEPFACE_AVAILABLE = False

def index(request):
    return render(request, 'face_emotion/index.html')

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.float32):
            return float(obj)
        return json.JSONEncoder.default(self, obj)

@csrf_exempt
def detect_emotion(request):
    try:
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)

        image_data = None
        
        # Xử lý ảnh từ form upload
        if 'image' in request.FILES:
            image = Image.open(request.FILES['image'])
            image_data = np.array(image)
            
        # Xử lý ảnh từ base64 (camera/video)
        elif 'image_data' in request.POST:
            base64_data = request.POST['image_data']
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            image_bytes = base64.b64decode(base64_data)
            image = Image.open(io.BytesIO(image_bytes))
            image_data = np.array(image)
        else:
            return JsonResponse({'error': 'No image data provided'}, status=400)

        # Chuyển đổi ảnh sang RGB nếu cần
        if len(image_data.shape) == 3 and image_data.shape[2] == 4:
            image_data = cv2.cvtColor(image_data, cv2.COLOR_RGBA2RGB)
        elif len(image_data.shape) == 2:
            image_data = cv2.cvtColor(image_data, cv2.COLOR_GRAY2RGB)

        # Phân tích cảm xúc
        result = DeepFace.analyze(
            image_data,
            actions=['emotion'],
            enforce_detection=False,
            detector_backend='retinaface'  # Thay đổi detector
        )

        if isinstance(result, list) and len(result) > 0:
            emotion_result = {
                "emotion": result[0]['dominant_emotion'],
                "all_emotions": {
                    emotion: float(score) 
                    for emotion, score in result[0]['emotion'].items()
                }
            }
            
            # Thêm thông tin khuôn mặt nếu có
            if 'region' in result[0]:
                emotion_result['face_coordinates'] = {
                    'x': result[0]['region']['x'],
                    'y': result[0]['region']['y'],
                    'width': result[0]['region']['w'],
                    'height': result[0]['region']['h']
                }

            return JsonResponse(emotion_result, encoder=NumpyEncoder)
        else:
            return JsonResponse({'error': 'No face detected'}, status=400)

    except Exception as e:
        logger.error(f"Error in emotion detection: {str(e)}")
        return JsonResponse({
            'error': 'Error processing image',
            'detail': str(e)
        }, status=500)

# API endpoint để kiểm tra trạng thái
@csrf_exempt
def health_check(request):
    """
    Endpoint để kiểm tra trạng thái của service
    """
    return JsonResponse({
        "status": "online",
        "deepface_available": DEEPFACE_AVAILABLE
    })
