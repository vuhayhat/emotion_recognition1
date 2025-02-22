class EmotionDetector {
    constructor() {
        this.videoRecognitionActive = false;
        this.videoRecognitionInterval = null;
        this.initializeElements();
        this.initializeEventListeners();
        this.isProcessing = false;
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.videoStream = stream;
            this.video.srcObject = stream;
            this.videoContainer.style.display = 'block';
            this.dropZone.style.display = 'none';

            // Bắt đầu nhận diện
            this.videoInterval = setInterval(async () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.video.videoWidth;
                    canvas.height = this.video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(this.video, 0, 0);

                    const result = await this.processImage(canvas.toDataURL('image/jpeg'), true);
                    this.updateVideoResult(result);
                } catch (error) {
                    console.error('Video recognition error:', error);
                }
            }, 1000);

        } catch (error) {
            this.showError('Không thể truy cập camera: ' + error.message);
        }
    }

    stopVideoRecognition() {
        const stream = this.video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        this.videoRecognitionActive = false;
        if (this.videoInterval) {
            clearInterval(this.videoInterval);
        }
        
        this.videoContainer.style.display = 'none';
        this.dropZone.style.display = 'block';
    }

    async processImage(imageData, isVideo = false) {
        if (this.isProcessing && !isVideo) return;
        this.isProcessing = true;

        try {
            const formData = new FormData();
            if (imageData instanceof Blob) {
                formData.append('image', imageData);
            } else {
                formData.append('image_data', imageData);
            }

            const response = await fetch('/detect_emotion/', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Lỗi xử lý ảnh');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        } finally {
            if (!isVideo) this.isProcessing = false;
        }
    }

    async capturePhoto() {
        if (this.isProcessing) return;

        try {
            // Hiển thị đếm ngược
            await this.showCountdown();

            // Chụp ảnh
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);

            // Chuyển đổi sang blob
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            
            // Hiển thị preview
            this.previewImage.src = URL.createObjectURL(blob);
            this.previewContainer.style.display = 'block';
            this.loadingSpinner.style.display = 'block';

            // Phân tích cảm xúc
            const result = await this.processImage(blob);
            this.showResult(result);

        } catch (error) {
            this.showError(error.message);
        } finally {
            this.loadingSpinner.style.display = 'none';
            this.stopCamera();
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