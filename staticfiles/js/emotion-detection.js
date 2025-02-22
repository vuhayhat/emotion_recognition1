class EmotionDetector {
    constructor() {
        this.videoRecognitionActive = false;
        this.videoRecognitionInterval = null;
        this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        // Camera elements
        this.video = document.getElementById('video-stream');
        this.canvas = document.getElementById('overlay-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.videoContainer = document.getElementById('video-recognition-container');
        this.dropZone = document.getElementById('drop-zone');
        this.emotionStats = document.getElementById('emotion-stats');
        this.previewContainer = document.getElementById('preview-container');
        this.previewImage = document.getElementById('preview-image');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.resultDiv = document.getElementById('result');
        this.errorDiv = document.getElementById('error');
    }

    initializeEventListeners() {
        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => this.highlight(this.dropZone), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => this.unhighlight(this.dropZone), false);
        });

        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e), false);
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFiles(e), false);

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.videoContainer.style.display = 'block';
            this.dropZone.style.display = 'none';
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
        }
    }

    async startVideoRecognition() {
        try {
            await this.startCamera();
            this.videoRecognitionActive = true;
            this.startEmotionDetection();
        } catch (err) {
            console.error("Error in video recognition:", err);
        }
    }

    stopVideoRecognition() {
        const stream = this.video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        this.videoRecognitionActive = false;
        if (this.videoRecognitionInterval) {
            clearInterval(this.videoRecognitionInterval);
        }
        
        this.videoContainer.style.display = 'none';
        this.dropZone.style.display = 'block';
    }

    async startEmotionDetection() {
        this.videoRecognitionInterval = setInterval(async () => {
            if (!this.videoRecognitionActive) return;

            try {
                await this.detectEmotionFromVideo();
            } catch (error) {
                console.error("Error in emotion detection:", error);
            }
        }, 1000);
    }

    async detectEmotionFromVideo() {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageBlob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/jpeg'));
        await this.uploadAndAnalyze(imageBlob);
    }

    async uploadAndAnalyze(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/detect_emotion/', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Có lỗi xảy ra khi xử lý ảnh');
            }

            this.updateEmotionDisplay(result);
            if (result.face_coordinates) {
                this.drawFaceRectangle(result.face_coordinates);
            }

        } catch (error) {
            this.showError(error.message);
        }
    }

    updateEmotionDisplay(result) {
        let statsHtml = '';
        Object.entries(result.all_emotions).forEach(([emotion, value]) => {
            const percentage = Math.round(value);
            statsHtml += this.createEmotionBar(emotion, percentage);
        });
        this.emotionStats.innerHTML = statsHtml;
    }

    createEmotionBar(emotion, percentage) {
        return `
            <div class="emotion-label">
                <span>${this.translateEmotion(emotion)}</span>
                <span>${percentage}%</span>
            </div>
            <div class="emotion-bar">
                <div class="emotion-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }

    drawFaceRectangle(coordinates) {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            coordinates.x,
            coordinates.y,
            coordinates.width,
            coordinates.height
        );
    }

    // Utility methods
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight(element) {
        element.classList.add('drag-highlight');
    }

    unhighlight(element) {
        element.classList.remove('drag-highlight');
    }

    showError(message) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
    }

    translateEmotion(emotion) {
        const translations = {
            'angry': 'Giận dữ',
            'disgust': 'Ghê tởm',
            'fear': 'Sợ hãi',
            'happy': 'Vui vẻ',
            'sad': 'Buồn bã',
            'surprise': 'Ngạc nhiên',
            'neutral': 'Bình thường'
        };
        return translations[emotion] || emotion;
    }

    cleanup() {
        this.stopVideoRecognition();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.emotionDetector = new EmotionDetector();
}); 