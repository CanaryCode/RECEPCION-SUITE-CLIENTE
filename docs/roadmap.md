# Roadmap — Recepción Suite

> Hoja de ruta viva. Se actualiza en cada SELLADO o cuando cambian las prioridades.
> **Formato**: mover las tareas entre columnas según avanzan. Anotar versión/fecha al completar.

---

## 🔴 Pendiente (por hacer)

- [ ] **Módulo de Check-in / Check-out**: Registro formal de entrada y salida de huéspedes vinculado al estado de habitaciones.
- [ ] **Notificaciones de escritorio**: Integrar la API de Notificaciones del navegador para alertas de despertadores y transfers sin necesidad de tener la pestaña activa.
- [ ] **Historial de cambios por habitación**: Poder ver todo lo que ha pasado en una habitación (atenciones, safe, RIU Class...) desde una vista unificada.
- [ ] **Multi-hotel / Selección de establecimiento**: Poder seleccionar desde el login a qué hotel conectarse (primer paso hacia la versión SaaS).
- [ ] **Exportación de datos**: Exportar los datos de cualquier módulo a CSV desde la app.

---

## 🟡 En Progreso

_Actualmente nada en progreso activo._

---

## ✅ Completado

| Versión   | Qué se hizo                                                            |
| --------- | ---------------------------------------------------------------------- |
| beta 1-5  | Módulos base: Novedades, Despertadores, Cenas Frías, Desayunos, Agenda |
| beta 6    | Router silencioso, Navegación sin parpadeos de navbar                  |
| beta 7    | Arquitectura dual DB+JSON, transacciones atómicas, WebSocket sync      |
| beta 8    | Seguridad: Login + Huella de hardware + Túnel inverso WebSocket        |
| beta 9    | Modernización Admin Console (CPU, red, indicadores de estado)          |
| beta 10   | Lanzador: iconografía unificada por categoría, integración Spotify     |
| beta 10   | Módulo Objetos Perdidos con imágenes Base64 en DB                      |
| beta 10   | Agent Launcher (C# → exe) con firma hardware                           |
| beta 10.2 | Quick Login Screen (one-click) y Refuerzo de Seguridad Barrier         |
| beta 10.2 | Fix Impresión PDF (Proxy CORS) y Handshake Agente (Híbrido HTTP/S)     |
| —         | Sistema de documentación modular (este sistema)                        |
