// Script principal para FaceRecPy - VERSIÓN CORREGIDA

// Variables globales
let videoIniciado = false;
let streamActivo = null;
let modeloCargado = false;
let personasRegistradas = [];
let intervaloDeteccion = null;
let ultimaDeteccion = null;
let deteccionesHoy = parseInt(localStorage.getItem('deteccionesHoy') || '0');
let tiemposDeteccion = [];
let rostrosConocidos = [];
let modalReconocimiento = null;

// Opciones de detección
const opcionesDeteccion = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
});

// Múltiples fuentes para los modelos
const MODEL_URLS = [
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models',
    'https://unpkg.com/face-api.js@0.22.2/models',
    'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
];

document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const menuLinks = document.querySelectorAll('.menu a');
    const modalDemo = document.getElementById('modal-demo');
    const abrirDemoBtn = document.getElementById('abrir-demo');
    const cerrarModalBtn = document.getElementById('cerrar-modal');
    const formularioContacto = document.getElementById('formulario-contacto');
    const formularioDemo = document.getElementById('formulario-demo');
    const verSolucionesBtn = document.getElementById('ver-soluciones');
    const contactarVentasBtn = document.getElementById('contactar-ventas');
    
    // Elementos de la demo
    const btnIniciarCamara = document.getElementById('btn-iniciar-camara');
    const btnCapturar = document.getElementById('btn-capturar');
    const btnRegistrar = document.getElementById('btn-registrar');
    const btnReconocer = document.getElementById('btn-reconocer');
    const btnDetener = document.getElementById('btn-detener');
    const video = document.getElementById('video-demo');
    const canvas = document.getElementById('canvas-demo');
    const estadoDemo = document.getElementById('estado-demo');
    const rostrosDemo = document.getElementById('rostros-demo');
    const edadDemo = document.getElementById('edad-demo');
    const generoDemo = document.getElementById('genero-demo');
    const expresionDemo = document.getElementById('expresion-demo');
    const confianzaDemo = document.getElementById('confianza-demo');
    const listaPersonas = document.getElementById('lista-personas');
    const overlayCamara = document.getElementById('camara-overlay');
    const contadorPersonas = document.getElementById('personas-count');
    const deteccionesHoyEl = document.getElementById('detecciones-hoy');
    const tiempoPromedioEl = document.getElementById('tiempo-promedio');

    // Verificar si faceapi está disponible
    if (typeof faceapi === 'undefined') {
        console.error('face-api.js no está cargado');
        if (estadoDemo) {
            estadoDemo.innerHTML = '<span class="status-dot offline"></span> Error: Biblioteca no cargada';
        }
        mostrarNotificacion('Error: face-api.js no está cargado. Recarga la página.', 'error');
        return;
    }

    // ===== FUNCIONES DE CARGA DE MODELOS =====
    
    async function cargarModelos() {
        const overlay = document.getElementById('overlay-carga');
        if (overlay) overlay.style.display = 'flex';
        
        if (estadoDemo) {
            estadoDemo.innerHTML = '<span class="status-dot"></span> Cargando modelos...';
        }
        
        // Intentar con cada fuente
        for (let i = 0; i < MODEL_URLS.length; i++) {
            const url = MODEL_URLS[i];
            
            try {
                console.log(`Intentando cargar modelos desde: ${url}`);
                actualizarMensajeCarga(`Intentando conexión ${i + 1}/${MODEL_URLS.length}...`);
                
                // Cargar modelos en orden
                await faceapi.nets.tinyFaceDetector.loadFromUri(url);
                actualizarEstadoPaso('detector', true);
                actualizarProgreso(20);
                
                await faceapi.nets.faceLandmark68Net.loadFromUri(url);
                actualizarEstadoPaso('landmarks', true);
                actualizarProgreso(40);
                
                await faceapi.nets.faceRecognitionNet.loadFromUri(url);
                actualizarEstadoPaso('reconocimiento', true);
                actualizarProgreso(60);
                
                await faceapi.nets.faceExpressionNet.loadFromUri(url);
                actualizarEstadoPaso('expresiones', true);
                actualizarProgreso(80);
                
                await faceapi.nets.ageGenderNet.loadFromUri(url);
                actualizarEstadoPaso('edad', true);
                actualizarProgreso(100);
                
                modeloCargado = true;
                console.log(`Modelos cargados exitosamente desde: ${url}`);
                
                setTimeout(() => {
                    if (overlay) overlay.style.display = 'none';
                    if (estadoDemo) {
                        estadoDemo.innerHTML = '<span class="status-dot" style="background: #4caf50;"></span> Modelos cargados ✓';
                    }
                    mostrarNotificacion('Modelos cargados correctamente', 'exito', '¡Listo!');
                }, 500);
                
                return; // Salir si tuvo éxito
                
            } catch (error) {
                console.warn(`Error cargando desde ${url}:`, error);
                actualizarProgreso(0);
                // Resetear estados
                document.querySelectorAll('.carga-pasos li').forEach(li => li.className = '');
            }
        }
        
        // Si llegamos aquí, todos los intentos fallaron
        if (overlay) {
            overlay.innerHTML = `
                <div class="carga-contenido">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 20px;"></i>
                    <h3>Error de conexión</h3>
                    <p>No se pudieron cargar los modelos de reconocimiento facial.</p>
                    <p style="font-size: 0.9rem; margin: 10px 0;">Verifica tu conexión a internet y recarga la página.</p>
                    <button onclick="location.reload()" class="boton-primario" style="margin-top: 20px;">
                        <i class="fas fa-redo-alt"></i> Reintentar
                    </button>
                </div>
            `;
        }
        
        if (estadoDemo) {
            estadoDemo.innerHTML = '<span class="status-dot offline"></span> Error: No se pudieron cargar los modelos';
        }
    }

    function actualizarMensajeCarga(mensaje) {
        const msgEl = document.getElementById('carga-mensaje');
        if (msgEl) msgEl.textContent = mensaje;
    }

    function actualizarProgreso(porcentaje) {
        const barra = document.getElementById('carga-barra');
        if (barra) barra.style.width = porcentaje + '%';
    }

    function actualizarEstadoPaso(paso, completado = false) {
        const elementos = {
            detector: document.getElementById('paso-detector'),
            landmarks: document.getElementById('paso-landmarks'),
            reconocimiento: document.getElementById('paso-reconocimiento'),
            expresiones: document.getElementById('paso-expresiones'),
            edad: document.getElementById('paso-edad')
        };
        
        if (elementos[paso]) {
            if (completado) {
                elementos[paso].className = 'completado';
            } else {
                elementos[paso].className = 'activo';
            }
        }
    }

    // ===== FUNCIONES DE CÁMARA =====
    
    async function iniciarCamara() {
        if (!modeloCargado) {
            mostrarNotificacion('Espera a que carguen los modelos', 'advertencia');
            return;
        }
        
        try {
            if (estadoDemo) {
                estadoDemo.innerHTML = '<span class="status-dot"></span> Solicitando permiso...';
            }
            
            if (overlayCamara) {
                overlayCamara.classList.add('hidden');
            }
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a cámara');
            }
            
            streamActivo = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            
            video.srcObject = streamActivo;
            videoIniciado = true;
            
            // Habilitar/deshabilitar botones
            if (btnIniciarCamara) btnIniciarCamara.disabled = true;
            if (btnCapturar) btnCapturar.disabled = false;
            if (btnRegistrar) btnRegistrar.disabled = false;
            if (btnReconocer) btnReconocer.disabled = true; // Inicialmente deshabilitado
            if (btnDetener) btnDetener.disabled = false;
            
            if (estadoDemo) {
                estadoDemo.innerHTML = '<span class="status-dot" style="background: #4caf50;"></span> Cámara activada ✓';
            }
            
            // Esperar a que el video esté listo
            video.addEventListener('play', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                iniciarDeteccion();
            }, { once: true });
            
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            if (estadoDemo) {
                estadoDemo.innerHTML = '<span class="status-dot offline"></span> Error: No se pudo acceder a la cámara';
            }
            
            let mensajeError = 'No se pudo acceder a la cámara. ';
            if (error.name === 'NotAllowedError') {
                mensajeError += 'Permiso denegado.';
            } else if (error.name === 'NotFoundError') {
                mensajeError += 'No se encontró cámara.';
            } else {
                mensajeError += 'Verifica los permisos.';
            }
            
            mostrarNotificacion(mensajeError, 'error');
        }
    }

    function detenerCamara() {
        if (streamActivo) {
            streamActivo.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamActivo = null;
        }
        
        if (intervaloDeteccion) {
            clearInterval(intervaloDeteccion);
            intervaloDeteccion = null;
        }
        
        if (video) {
            video.srcObject = null;
        }
        
        videoIniciado = false;
        
        // Habilitar/deshabilitar botones
        if (btnIniciarCamara) btnIniciarCamara.disabled = false;
        if (btnCapturar) btnCapturar.disabled = true;
        if (btnRegistrar) btnRegistrar.disabled = true;
        if (btnReconocer) btnReconocer.disabled = true;
        if (btnDetener) btnDetener.disabled = true;
        
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        if (estadoDemo) {
            estadoDemo.innerHTML = '<span class="status-dot offline"></span> Cámara detenida';
        }
        
        if (overlayCamara) {
            overlayCamara.classList.remove('hidden');
        }
        
        // Limpiar datos
        if (rostrosDemo) rostrosDemo.textContent = '0';
        if (edadDemo) edadDemo.textContent = '-';
        if (generoDemo) generoDemo.textContent = '-';
        if (expresionDemo) expresionDemo.textContent = '-';
        if (confianzaDemo) confianzaDemo.textContent = '-';
        
        ultimaDeteccion = null;
        
        mostrarNotificacion('Cámara detenida', 'info');
    }

    // ===== FUNCIONES DE DETECCIÓN =====
    
    function iniciarDeteccion() {
        if (intervaloDeteccion) {
            clearInterval(intervaloDeteccion);
        }
        
        intervaloDeteccion = setInterval(async () => {
            if (videoIniciado && modeloCargado && video.readyState === 4) {
                const startTime = performance.now();
                await detectarRostros();
                const endTime = performance.now();
                actualizarEstadisticasDemo(endTime - startTime);
            }
        }, 200);
    }

    async function detectarRostros() {
        try {
            const detecciones = await faceapi
                .detectAllFaces(video, opcionesDeteccion)
                .withFaceLandmarks()
                .withFaceDescriptors()
                .withFaceExpressions()
                .withAgeAndGender();
            
            if (rostrosDemo) rostrosDemo.textContent = detecciones.length;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detecciones.length > 0) {
                // Dibujar detecciones
                faceapi.draw.drawDetections(canvas, detecciones);
                
                if (detecciones.length <= 2) {
                    faceapi.draw.drawFaceLandmarks(canvas, detecciones);
                }
                
                const deteccion = detecciones[0];
                
                // Reconocimiento facial automático
                let personaReconocida = null;
                let mejorDistancia = 0.6;
                
                if (rostrosConocidos.length > 0 && deteccion.descriptor) {
                    for (const conocida of rostrosConocidos) {
                        const distancia = faceapi.euclideanDistance(deteccion.descriptor, conocida.descriptor);
                        if (distancia < mejorDistancia) {
                            mejorDistancia = distancia;
                            personaReconocida = conocida;
                        }
                    }
                }
                
                ultimaDeteccion = {
                    ...deteccion,
                    personaReconocida: personaReconocida
                };
                
                // HABILITAR BOTÓN RECONOCER - ¡ESTA ES LA LÍNEA CLAVE!
                if (btnReconocer) {
                    btnReconocer.disabled = false;
                }
                
                // Actualizar UI
                if (edadDemo) edadDemo.textContent = deteccion.age ? `${Math.round(deteccion.age)} años` : 'Desconocido';
                if (generoDemo) generoDemo.textContent = deteccion.gender === 'male' ? 'Masculino' : 'Femenino';
                if (confianzaDemo && deteccion.detection) {
                    confianzaDemo.textContent = `${Math.round(deteccion.detection.score * 100)}%`;
                }
                
                if (expresionDemo && deteccion.expressions) {
                    const expresiones = deteccion.expressions;
                    let maxExpresion = '';
                    let maxValor = 0;
                    
                    for (let [expresion, valor] of Object.entries(expresiones)) {
                        if (valor > maxValor) {
                            maxValor = valor;
                            maxExpresion = expresion;
                        }
                    }
                    
                    const expresionesEsp = {
                        neutral: 'Neutral',
                        happy: 'Feliz 😊',
                        sad: 'Triste 😔',
                        angry: 'Enojado 😠',
                        fearful: 'Asustado 😨',
                        disgusted: 'Disgustado 🤢',
                        surprised: 'Sorprendido 😮'
                    };
                    
                    expresionDemo.textContent = expresionesEsp[maxExpresion] || maxExpresion;
                }
                
                if (personaReconocida && estadoDemo) {
                    estadoDemo.innerHTML = `<span class="status-dot" style="background: #4caf50;"></span> Reconocido: ${personaReconocida.nombre}`;
                } else if (estadoDemo && videoIniciado) {
                    estadoDemo.innerHTML = '<span class="status-dot" style="background: #4caf50;"></span> Cámara activada ✓';
                }
                
            } else {
                // No hay rostros detectados
                if (edadDemo) edadDemo.textContent = '-';
                if (generoDemo) generoDemo.textContent = '-';
                if (expresionDemo) expresionDemo.textContent = '-';
                if (confianzaDemo) confianzaDemo.textContent = '-';
                
                // DESHABILITAR BOTÓN RECONOCER cuando no hay rostros
                if (btnReconocer) {
                    btnReconocer.disabled = true;
                }
                
                ultimaDeteccion = null;
                
                if (estadoDemo && videoIniciado) {
                    estadoDemo.innerHTML = '<span class="status-dot" style="background: #4caf50;"></span> Cámara activada ✓';
                }
            }
            
        } catch (error) {
            console.error('Error en detección:', error);
        }
    }

    // ===== FUNCIÓN DE RECONOCIMIENTO MANUAL =====

    async function reconocerPersona() {
        if (!videoIniciado) {
            mostrarNotificacion('La cámara no está activada', 'advertencia');
            return;
        }
        
        if (!ultimaDeteccion || !ultimaDeteccion.descriptor) {
            mostrarNotificacion('No hay rostro detectado para reconocer', 'advertencia');
            return;
        }
        
        if (rostrosConocidos.length === 0) {
            mostrarNotificacion('No hay personas registradas en el sistema', 'advertencia');
            return;
        }
        
        try {
            // Mostrar indicador de búsqueda
            mostrarNotificacion('Buscando coincidencias...', 'info');
            
            // Buscar la mejor coincidencia
            let mejorCoincidencia = null;
            let mejorDistancia = 0.6; // Umbral de similitud
            let todasLasDistancias = [];
            
            for (const conocida of rostrosConocidos) {
                const distancia = faceapi.euclideanDistance(ultimaDeteccion.descriptor, conocida.descriptor);
                todasLasDistancias.push({
                    nombre: conocida.nombre,
                    distancia: distancia,
                    similitud: Math.round((1 - distancia) * 100)
                });
                
                if (distancia < mejorDistancia) {
                    mejorDistancia = distancia;
                    mejorCoincidencia = conocida;
                }
            }
            
            // Ordenar por similitud
            todasLasDistancias.sort((a, b) => a.distancia - b.distancia);
            
            // Mostrar resultados
            if (mejorCoincidencia) {
                const similitud = Math.round((1 - mejorDistancia) * 100);
                
                // Actualizar contador de reconocimientos
                const personaIndex = personasRegistradas.findIndex(p => p.nombre === mejorCoincidencia.nombre);
                if (personaIndex !== -1) {
                    personasRegistradas[personaIndex].reconocimientos = (personasRegistradas[personaIndex].reconocimientos || 0) + 1;
                    guardarPersonas();
                    actualizarListaPersonas();
                }
                
                mostrarResultadoReconocimiento({
                    success: true,
                    nombre: mejorCoincidencia.nombre,
                    similitud: similitud,
                    distancia: mejorDistancia,
                    todas: todasLasDistancias.slice(0, 3) // Top 3
                });
                
                // Actualizar estado
                if (estadoDemo) {
                    estadoDemo.innerHTML = `<span class="status-dot" style="background: #4caf50;"></span> Reconocido: ${mejorCoincidencia.nombre} (${similitud}%)`;
                }
                
            } else {
                mostrarResultadoReconocimiento({
                    success: false,
                    todas: todasLasDistancias.slice(0, 3)
                });
                
                if (estadoDemo) {
                    estadoDemo.innerHTML = '<span class="status-dot offline"></span> No se encontró coincidencia';
                }
            }
            
        } catch (error) {
            console.error('Error en reconocimiento:', error);
            mostrarNotificacion('Error al procesar el reconocimiento', 'error');
        }
    }

    // Mostrar modal con resultados
    function mostrarResultadoReconocimiento(resultado) {
        // Crear modal si no existe
        if (!modalReconocimiento) {
            modalReconocimiento = document.createElement('div');
            modalReconocimiento.className = 'modal-reconocimiento';
            modalReconocimiento.innerHTML = `
                <div class="modal-contenido">
                    <div class="modal-icono" id="modal-icono"></div>
                    <h3 id="modal-titulo"></h3>
                    <p id="modal-mensaje"></p>
                    <div id="modal-detalles" class="reconocimiento-detalles"></div>
                    <div id="modal-sugerencias" class="reconocimiento-sugerencias"></div>
                    <button class="btn-cerrar" id="modal-cerrar">Cerrar</button>
                </div>
            `;
            document.body.appendChild(modalReconocimiento);
            
            document.getElementById('modal-cerrar').addEventListener('click', () => {
                modalReconocimiento.classList.remove('mostrar');
            });
        }
        
        const icono = document.getElementById('modal-icono');
        const titulo = document.getElementById('modal-titulo');
        const mensaje = document.getElementById('modal-mensaje');
        const detalles = document.getElementById('modal-detalles');
        const sugerencias = document.getElementById('modal-sugerencias');
        
        if (resultado.success) {
            icono.className = 'modal-icono success';
            icono.innerHTML = '<i class="fas fa-check-circle"></i>';
            titulo.textContent = '¡Persona reconocida!';
            mensaje.textContent = `Se encontró una coincidencia con ${resultado.similitud}% de similitud.`;
            
            detalles.innerHTML = `
                <div class="detalle-item">
                    <span class="detalle-label">Nombre:</span>
                    <span class="detalle-valor">${resultado.nombre}</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Similitud:</span>
                    <span class="detalle-valor">${resultado.similitud}%</span>
                </div>
                <div class="detalle-item">
                    <span class="detalle-label">Distancia:</span>
                    <span class="detalle-valor">${resultado.distancia.toFixed(3)}</span>
                </div>
            `;
            
            // Mostrar otras posibles coincidencias
            if (resultado.todas && resultado.todas.length > 1) {
                sugerencias.innerHTML = '<h4>Otras posibles coincidencias:</h4>';
                resultado.todas.slice(1).forEach(r => {
                    sugerencias.innerHTML += `
                        <div class="sugerencia-item" onclick="seleccionarSugerencia('${r.nombre}')">
                            <i class="fas fa-user"></i>
                            <span>${r.nombre} (${r.similitud}% similitud)</span>
                        </div>
                    `;
                });
            } else {
                sugerencias.innerHTML = '';
            }
            
        } else {
            icono.className = 'modal-icono warning';
            icono.innerHTML = '<i class="fas fa-question-circle"></i>';
            titulo.textContent = 'No se encontró coincidencia';
            mensaje.textContent = 'El rostro detectado no coincide con ninguna persona registrada.';
            
            if (resultado.todas && resultado.todas.length > 0) {
                detalles.innerHTML = '<h4>Coincidencias más cercanas:</h4>';
                resultado.todas.forEach(r => {
                    detalles.innerHTML += `
                        <div class="sugerencia-item" onclick="seleccionarSugerencia('${r.nombre}')">
                            <i class="fas fa-user"></i>
                            <span>${r.nombre} (${r.similitud}% similitud)</span>
                        </div>
                    `;
                });
            } else {
                detalles.innerHTML = '<p>No hay personas registradas para comparar.</p>';
            }
            
            sugerencias.innerHTML = '';
        }
        
        modalReconocimiento.classList.add('mostrar');
    }

    // ===== FUNCIONES DE CAPTURA Y REGISTRO =====
    
    function capturarFoto() {
        if (!videoIniciado) {
            mostrarNotificacion('La cámara no está activada', 'advertencia');
            return;
        }
        
        const canvasTemp = document.createElement('canvas');
        canvasTemp.width = video.videoWidth;
        canvasTemp.height = video.videoHeight;
        canvasTemp.getContext('2d').drawImage(video, 0, 0);
        
        const enlace = document.createElement('a');
        enlace.download = `captura_${Date.now()}.png`;
        enlace.href = canvasTemp.toDataURL('image/png');
        enlace.click();
        
        mostrarNotificacion('¡Foto capturada!', 'exito');
    }

    async function registrarPersona() {
        if (!videoIniciado) {
            mostrarNotificacion('La cámara no está activada', 'advertencia');
            return;
        }
        
        if (!ultimaDeteccion || !ultimaDeteccion.descriptor) {
            mostrarNotificacion('No hay rostro detectado o no se pudo obtener el descriptor facial', 'advertencia');
            return;
        }
        
        const nombre = prompt('Ingresa el nombre de la persona:');
        if (!nombre) return;
        
        // Verificar si ya existe
        const existe = rostrosConocidos.some(r => r.nombre.toLowerCase() === nombre.toLowerCase());
        if (existe) {
            mostrarNotificacion('Ya existe una persona con ese nombre', 'advertencia');
            return;
        }
        
        // Capturar la imagen actual
        const canvasTemp = document.createElement('canvas');
        canvasTemp.width = video.videoWidth;
        canvasTemp.height = video.videoHeight;
        canvasTemp.getContext('2d').drawImage(video, 0, 0);
        
        // Crear objeto persona con descriptor facial
        const nuevaPersona = {
            id: Date.now(),
            nombre: nombre,
            fecha: new Date().toLocaleString(),
            edad: ultimaDeteccion.age ? Math.round(ultimaDeteccion.age) : 'Desconocido',
            genero: ultimaDeteccion.gender === 'male' ? 'Masculino' : 'Femenino',
            expresion: expresionDemo ? expresionDemo.textContent : 'Desconocido',
            imagen: canvasTemp.toDataURL('image/jpeg', 0.3),
            descriptor: Array.from(ultimaDeteccion.descriptor),
            reconocimientos: 0
        };
        
        personasRegistradas.push(nuevaPersona);
        
        // Añadir a rostros conocidos para reconocimiento
        rostrosConocidos.push({
            nombre: nuevaPersona.nombre,
            descriptor: ultimaDeteccion.descriptor
        });
        
        actualizarListaPersonas();
        guardarPersonas();
        
        mostrarNotificacion(`¡${nombre} registrado correctamente!`, 'exito');
    }

    // Función para seleccionar una sugerencia
    window.seleccionarSugerencia = function(nombre) {
        const persona = personasRegistradas.find(p => p.nombre === nombre);
        if (persona && ultimaDeteccion && ultimaDeteccion.descriptor) {
            const confirmar = confirm(`¿Quieres actualizar el registro de "${nombre}" con este nuevo rostro?`);
            if (confirmar) {
                // Actualizar el descriptor de la persona existente
                persona.descriptor = Array.from(ultimaDeteccion.descriptor);
                
                // Actualizar rostrosConocidos
                const index = rostrosConocidos.findIndex(r => r.nombre === nombre);
                if (index !== -1) {
                    rostrosConocidos[index].descriptor = ultimaDeteccion.descriptor;
                }
                
                guardarPersonas();
                actualizarListaPersonas();
                mostrarNotificacion(`Descriptor actualizado para ${nombre}`, 'exito');
                
                if (modalReconocimiento) {
                    modalReconocimiento.classList.remove('mostrar');
                }
            }
        }
    };

    // Actualizar lista de personas
    function actualizarListaPersonas() {
        if (!listaPersonas) return;
        
        if (personasRegistradas.length === 0) {
            listaPersonas.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <p>No hay personas registradas</p>
                    <small>Captura y registra un rostro para comenzar</small>
                </div>
            `;
            if (contadorPersonas) contadorPersonas.textContent = '0';
            return;
        }
        
        listaPersonas.innerHTML = personasRegistradas
            .map(persona => `
                <div class="persona-item" data-id="${persona.id}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${persona.imagen ? 
                            `<img src="${persona.imagen}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-primario);">` 
                            : '<div style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center;"><i class="fas fa-user"></i></div>'}
                        <div style="flex: 1;">
                            <div class="persona-nombre">${persona.nombre}</div>
                            <div class="persona-fecha">${persona.fecha}</div>
                        </div>
                    </div>
                    <div class="persona-reconocimientos">
                        Edad: ${persona.edad} | Género: ${persona.genero}<br>
                        Expresión: ${persona.expresion}
                        ${persona.reconocimientos > 0 ? `<br><small>✅ Reconocida ${persona.reconocimientos} veces</small>` : ''}
                    </div>
                </div>
            `)
            .join('');
        
        if (contadorPersonas) {
            contadorPersonas.textContent = personasRegistradas.length;
        }
    }

    // Guardar personas en localStorage
    function guardarPersonas() {
        try {
            localStorage.setItem('facerecpy_personas', JSON.stringify(personasRegistradas));
            
            // Reconstruir rostrosConocidos
            rostrosConocidos = personasRegistradas
                .filter(p => p.descriptor)
                .map(p => ({
                    nombre: p.nombre,
                    descriptor: new Float32Array(p.descriptor)
                }));
                
        } catch (e) {
            console.warn('Error guardando en localStorage:', e);
        }
    }

    // Cargar personas de localStorage
    function cargarPersonas() {
        try {
            const guardadas = localStorage.getItem('facerecpy_personas');
            if (guardadas) {
                personasRegistradas = JSON.parse(guardadas);
                
                // Reconstruir descriptores
                rostrosConocidos = personasRegistradas
                    .filter(p => p.descriptor)
                    .map(p => ({
                        nombre: p.nombre,
                        descriptor: new Float32Array(p.descriptor)
                    }));
                
                actualizarListaPersonas();
            }
        } catch (e) {
            console.warn('Error cargando de localStorage:', e);
        }
    }

    // Actualizar estadísticas de demo
    function actualizarEstadisticasDemo(tiempoMs) {
        deteccionesHoy++;
        localStorage.setItem('deteccionesHoy', deteccionesHoy);
        
        tiemposDeteccion.push(tiempoMs);
        if (tiemposDeteccion.length > 100) tiemposDeteccion.shift();
        
        const promedio = tiemposDeteccion.reduce((a, b) => a + b, 0) / tiemposDeteccion.length;
        
        if (deteccionesHoyEl) deteccionesHoyEl.textContent = deteccionesHoy;
        if (tiempoPromedioEl) tiempoPromedioEl.textContent = `${Math.round(promedio)}ms`;
    }

    // Mostrar notificación
    function mostrarNotificacion(mensaje, tipo = 'info', titulo = '') {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion ${tipo}`;
        
        const iconos = {
            exito: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            advertencia: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };
        
        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo] || iconos.info}"></i>
            <div class="notificacion-contenido">
                <div class="notificacion-titulo">${titulo || tipo.charAt(0).toUpperCase() + tipo.slice(1)}</div>
                <div class="notificacion-mensaje">${mensaje}</div>
            </div>
            <i class="fas fa-times notificacion-cerrar"></i>
        `;
        
        document.body.appendChild(notificacion);
        
        notificacion.querySelector('.notificacion-cerrar').addEventListener('click', () => {
            notificacion.remove();
        });
        
        setTimeout(() => notificacion.remove(), 5000);
    }

    // ===== EVENT LISTENERS =====
    
    if (btnIniciarCamara) btnIniciarCamara.addEventListener('click', iniciarCamara);
    if (btnCapturar) btnCapturar.addEventListener('click', capturarFoto);
    if (btnRegistrar) btnRegistrar.addEventListener('click', registrarPersona);
    if (btnReconocer) btnReconocer.addEventListener('click', reconocerPersona);
    if (btnDetener) btnDetener.addEventListener('click', detenerCamara);

    // Modal
    if (abrirDemoBtn && modalDemo) {
        abrirDemoBtn.addEventListener('click', () => {
            modalDemo.classList.add('mostrar');
            document.body.style.overflow = 'hidden';
        });
    }

    if (cerrarModalBtn && modalDemo) {
        cerrarModalBtn.addEventListener('click', () => {
            modalDemo.classList.remove('mostrar');
            document.body.style.overflow = 'auto';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modalDemo) {
            modalDemo.classList.remove('mostrar');
            document.body.style.overflow = 'auto';
        }
    });

    // Botones de hero
    if (verSolucionesBtn) {
        verSolucionesBtn.addEventListener('click', function() {
            document.querySelector('#soluciones').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    if (contactarVentasBtn) {
        contactarVentasBtn.addEventListener('click', function() {
            document.querySelector('#contacto').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    // Smooth scroll para menú
    if (menuLinks && menuLinks.length > 0) {
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // Resaltar enlace activo
    function resaltarEnlaceActivo() {
        const secciones = document.querySelectorAll('section');
        const scrollPos = window.scrollY + 100;

        secciones.forEach(seccion => {
            const top = seccion.offsetTop;
            const bottom = top + seccion.offsetHeight;
            const id = seccion.getAttribute('id');
            
            if (scrollPos >= top && scrollPos < bottom) {
                menuLinks.forEach(link => {
                    link.classList.remove('activo');
                    const href = link.getAttribute('href');
                    if (href && href === `#${id}`) {
                        link.classList.add('activo');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', resaltarEnlaceActivo);

    // Formularios
    if (formularioContacto) {
        formularioContacto.addEventListener('submit', (e) => {
            e.preventDefault();
            mostrarNotificacion('¡Mensaje enviado con éxito!', 'exito');
            formularioContacto.reset();
        });
    }

    if (formularioDemo) {
        formularioDemo.addEventListener('submit', (e) => {
            e.preventDefault();
            mostrarNotificacion('¡Solicitud enviada! Te contactaremos pronto.', 'exito');
            formularioDemo.reset();
            if (modalDemo) modalDemo.classList.remove('mostrar');
            document.body.style.overflow = 'auto';
        });
    }

    // Animaciones al scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.tarjeta-solucion, .paso-item, .solucion-card, .caso-card').forEach(el => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        }
    });

    // Inicialización
    window.addEventListener('load', () => {
        resaltarEnlaceActivo();
        cargarPersonas();
        
        // Mostrar overlay de carga
        setTimeout(() => {
            cargarModelos();
        }, 500);
    });

    // Limpiar al cerrar
    window.addEventListener('beforeunload', () => {
        if (videoIniciado) {
            detenerCamara();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && videoIniciado) {
            detenerCamara();
        }
    });
});