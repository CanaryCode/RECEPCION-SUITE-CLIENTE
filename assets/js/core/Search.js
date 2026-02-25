/**
 * SISTEMA DE BÚSQUEDA GLOBAL
 * --------------------------
 * Este módulo gestiona el buscador de la barra superior. Permite a los usuarios
 * encontrar rápidamente cualquier sección del programa sin navegar por los menús.
 */

export const Search = {
    /**
     * INICIALIZACIÓN
     * Configura los eventos de teclado y foco en el input de búsqueda.
     */
    init: () => {
        const searchInput = document.getElementById('appGlobalSearchInput');

        if (searchInput) {
            // FIX: Asegurar que esté vacío al iniciar (importante para evitar glitches visuales)
            searchInput.value = '';
            
            // Evento al escribir: Cada letra que pulsamos dispara la búsqueda
            searchInput.addEventListener('input', function (e) {
                Search.realizarBusqueda(e.target.value);
            });

            // Evento al hacer clic: Muestra opciones sugeridas (las primeras 15) nada más entrar
            searchInput.addEventListener('focus', function () {
                Search.realizarBusqueda(this.value);
            });
        }

        // Si hacemos clic en cualquier otro sitio de la pantalla, cerramos los resultados
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-search-wrapper')) {
                document.getElementById('searchResults')?.classList.add('d-none');
            }
        });

        // Funciones auxiliares expuestas para los clics en los resultados
        window.activarResultado = Search.activarResultado;
        window.currentSearchMatches = [];
    },

    /**
     * REALIZAR BÚSQUEDA
     * Escanea todos los menús y botones para encontrar coincidencias con el texto.
     */
    realizarBusqueda: (term) => {
        term = term.toLowerCase();
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        // Buscamos dentro de todos los enlaces del menú principal y submenús
        const links = document.querySelectorAll('#mainTabs .nav-link:not(.dropdown-toggle), #mainTabs .dropdown-item');
        let matches = [];

        links.forEach(link => {
            const text = link.textContent.trim();
            if (!text) return;

            // No queremos que en el buscador salgan los nombres de los recepcionistas (UserList)
            if (link.closest('#globalUserList')) return;

            // Si el texto del menú contiene lo que buscamos, lo añadimos a la lista
            if (term === '' || text.toLowerCase().includes(term)) {
                matches.push({ text: link.innerHTML, el: link });
            }
        });

        // Renderizar los resultados en el desplegable
        if (matches.length > 0) {
            // Si el buscador está vacío (foco), limitamos a 15 para no saturar la pantalla
            const limit = term === '' ? 15 : matches.length;
            const displayMatches = matches.slice(0, limit);

            let html = displayMatches.map((m, i) =>
                `<button class="list-group-item list-group-item-action small border-0 py-2 text-start" onclick="activarResultado(${i})">${m.text}</button>`
            ).join('');

            if (matches.length > limit) {
                html += `<div class="p-2 text-muted small text-center fst-italic">... y ${matches.length - limit} más</div>`;
            }

            resultsContainer.innerHTML = html;
            window.currentSearchMatches = matches.map(m => m.el); // Guardamos los elementos originales para poder hacerles click
            resultsContainer.classList.remove('d-none');
        } else {
            resultsContainer.innerHTML = '<div class="p-2 text-muted small text-center">No se ha encontrado nada</div>';
            resultsContainer.classList.remove('d-none');
        }
    },

    /**
     * ACTIVAR RESULTADO
     * Simula un clic en el botón del menú original.
     */
    activarResultado: (index) => {
        const el = window.currentSearchMatches[index];
        if (el) {
            // Hacemos un clic real en el elemento del menú original
            el.click();

            // Si el elemento estaba dentro de un menú desplegable, lo cerramos
            const dropdownMenu = el.closest('.dropdown-menu');
            if (dropdownMenu) {
                const dropdownToggle = dropdownMenu.closest('.dropdown')?.querySelector('.dropdown-toggle');
                if (dropdownToggle) {
                    const bsDropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
                    if (bsDropdown) bsDropdown.hide();
                }
            }
        }
        
        // Limpiamos el buscador después de navegar
        document.getElementById('appGlobalSearchInput').value = '';
        document.getElementById('searchResults').classList.add('d-none');
    }
};
