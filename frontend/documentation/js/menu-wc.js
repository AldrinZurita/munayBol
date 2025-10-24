'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">frontend-turismo-hoteleria documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                                <li class="link">
                                    <a href="overview.html" data-type="chapter-link">
                                        <span class="icon ion-ios-keypad"></span>Overview
                                    </a>
                                </li>

                            <li class="link">
                                <a href="index.html" data-type="chapter-link">
                                    <span class="icon ion-ios-paper"></span>
                                        README
                                </a>
                            </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>

                    </ul>
                </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-bs-toggle="collapse" ${ isNormalMode ?
                                'data-bs-target="#modules-links"' : 'data-bs-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/IconsModule.html" data-type="entity-link" >IconsModule</a>
                            </li>
                            <li class="link">
                                <a href="modules/SharedModule.html" data-type="entity-link" >SharedModule</a>
                            </li>
                </ul>
                </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#components-links"' :
                            'data-bs-target="#xs-components-links"' }>
                            <span class="icon ion-md-cog"></span>
                            <span>Components</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="components-links"' : 'id="xs-components-links"' }>
                            <li class="link">
                                <a href="components/App.html" data-type="entity-link" >App</a>
                            </li>
                            <li class="link">
                                <a href="components/AsistenteIa.html" data-type="entity-link" >AsistenteIa</a>
                            </li>
                            <li class="link">
                                <a href="components/CrearPaquete.html" data-type="entity-link" >CrearPaquete</a>
                            </li>
                            <li class="link">
                                <a href="components/Footer.html" data-type="entity-link" >Footer</a>
                            </li>
                            <li class="link">
                                <a href="components/HabitacionDetalle.html" data-type="entity-link" >HabitacionDetalle</a>
                            </li>
                            <li class="link">
                                <a href="components/Habitaciones.html" data-type="entity-link" >Habitaciones</a>
                            </li>
                            <li class="link">
                                <a href="components/HotelDetalleComponent.html" data-type="entity-link" >HotelDetalleComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/Hoteles.html" data-type="entity-link" >Hoteles</a>
                            </li>
                            <li class="link">
                                <a href="components/Inicio.html" data-type="entity-link" >Inicio</a>
                            </li>
                            <li class="link">
                                <a href="components/LoginComponent.html" data-type="entity-link" >LoginComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/LugaresTuristicos.html" data-type="entity-link" >LugaresTuristicos</a>
                            </li>
                            <li class="link">
                                <a href="components/LugaresTuristicosDetalle.html" data-type="entity-link" >LugaresTuristicosDetalle</a>
                            </li>
                            <li class="link">
                                <a href="components/NavbarComponent.html" data-type="entity-link" >NavbarComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/NotificationComponent.html" data-type="entity-link" >NotificationComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/PaqueteDetalle.html" data-type="entity-link" >PaqueteDetalle</a>
                            </li>
                            <li class="link">
                                <a href="components/Paquetes.html" data-type="entity-link" >Paquetes</a>
                            </li>
                            <li class="link">
                                <a href="components/Perfil.html" data-type="entity-link" >Perfil</a>
                            </li>
                            <li class="link">
                                <a href="components/Registrarse.html" data-type="entity-link" >Registrarse</a>
                            </li>
                            <li class="link">
                                <a href="components/ReservaComponent.html" data-type="entity-link" >ReservaComponent</a>
                            </li>
                            <li class="link">
                                <a href="components/ReservaDetalleComponent.html" data-type="entity-link" >ReservaDetalleComponent</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#injectables-links"' :
                                'data-bs-target="#xs-injectables-links"' }>
                                <span class="icon ion-md-arrow-round-down"></span>
                                <span>Injectables</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="injectables-links"' : 'id="xs-injectables-links"' }>
                                <li class="link">
                                    <a href="injectables/AsistenteIaService.html" data-type="entity-link" >AsistenteIaService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/AuthService.html" data-type="entity-link" >AuthService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/HabitacionService.html" data-type="entity-link" >HabitacionService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/HotelService.html" data-type="entity-link" >HotelService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/LugaresService.html" data-type="entity-link" >LugaresService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/NotificationService.html" data-type="entity-link" >NotificationService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/PagoService.html" data-type="entity-link" >PagoService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/PaqueteService.html" data-type="entity-link" >PaqueteService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/RegistrarseService.html" data-type="entity-link" >RegistrarseService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ReservaService.html" data-type="entity-link" >ReservaService</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/ReservasService.html" data-type="entity-link" >ReservasService</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interceptors-links"' :
                            'data-bs-target="#xs-interceptors-links"' }>
                            <span class="icon ion-ios-swap"></span>
                            <span>Interceptors</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="interceptors-links"' : 'id="xs-interceptors-links"' }>
                            <li class="link">
                                <a href="interceptors/JwtInterceptor.html" data-type="entity-link" >JwtInterceptor</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/AmenidadChip.html" data-type="entity-link" >AmenidadChip</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CrearReservaDTO.html" data-type="entity-link" >CrearReservaDTO</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/DisponibilidadHabitacionResponse.html" data-type="entity-link" >DisponibilidadHabitacionResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Habitacion.html" data-type="entity-link" >Habitacion</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Hotel.html" data-type="entity-link" >Hotel</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Hotel-1.html" data-type="entity-link" >Hotel</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IntervaloReservado.html" data-type="entity-link" >IntervaloReservado</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/LoginResponse.html" data-type="entity-link" >LoginResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Lugar.html" data-type="entity-link" >Lugar</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/LugarTuristico.html" data-type="entity-link" >LugarTuristico</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Notification.html" data-type="entity-link" >Notification</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Pago.html" data-type="entity-link" >Pago</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Paquete.html" data-type="entity-link" >Paquete</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Reserva.html" data-type="entity-link" >Reserva</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ReservaDetalle.html" data-type="entity-link" >ReservaDetalle</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ReservaResponse.html" data-type="entity-link" >ReservaResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Review.html" data-type="entity-link" >Review</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Usuario.html" data-type="entity-link" >Usuario</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/typealiases.html" data-type="entity-link">Type aliases</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <a data-type="chapter-link" href="routes.html"><span class="icon ion-ios-git-branch"></span>Routes</a>
                        </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});