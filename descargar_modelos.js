// Script para descargar modelos (ejecutar en Node.js o en navegador)
const modelos = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1',
    'age_gender_model-weights_manifest.json',
    'age_gender_model-shard1'
];

const baseUrl = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models/';

modelos.forEach(modelo => {
    fetch(baseUrl + modelo)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = modelo;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        });
});