'use strict';

const search = document.querySelector('.search');
const searchButton = document.querySelector('.button');
const cityName = document.querySelector('.city-name');
const dateTime = document.querySelector('.date-time');
const weatherInfo = document.querySelector('.weather-info');
const suggestionBox = document.querySelector('.suggestion-box');
const weatherIcon = document.querySelector('.weather-logo');
const infoContainer = document.querySelector('.info-container');
const historyContainer = document.querySelector('.history');
const loader = document.querySelector('.loader');
const clearHistory = document.querySelector('.clear-history');
const heading = document.querySelector('.heading-54');

class App {
    #map;
    #zoomLevel = 13;
    #apikey = '920bda174f134f73881152806241512';
    #pastSearches = [];
    #markers = [];

    constructor() {
        this._loadMap();
        searchButton.addEventListener('click', this._getSuggestion.bind(this));
        historyContainer.addEventListener('click', this._pastClickEvent.bind(this));
        this._getLocalStorage();
        clearHistory.addEventListener('click', this._clearHistory.bind(this));
        search.addEventListener('click', this._inputAnimation.bind(this));
        heading.addEventListener('click', () => location.reload());
    }

    async _loadMap() {
        try {
            this.#map = L.map('map').setView([23.185884, 79.974380], this.#zoomLevel);

            L.tileLayer('https://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(this.#map);

            this.#map.on('click', this._mapClickEvent.bind(this));
        } catch (error) {
            alert('Try Reloading the page');
        }
    }

    _setView(latitude, longitude, zoom = 8) {
        this.#map.setView([latitude, longitude], zoom, {
            animate: true,
            pan: { duration: 0.5 }
        });
    }

    _setMarker(latitude, longitude, city) {
        if (this._isMarkerExists(city)) return; // Check if marker already exists

        this._setView(latitude, longitude);
        const marker = L.marker([latitude, longitude], {
            autoClose: false,
            closeOnClick: false
        })
        .addTo(this.#map)
        .bindPopup(`${city}`, { autoClose: false, closeOnClick: false })
        .openPopup();
        
        this.#markers.push({ marker, city });
        this._setlocalStorage();
    }

    _isMarkerExists(city) {
        return this.#markers.some(({ marker }) => marker.getPopup().getContent() === city);
    }

    async _mapClickEvent(e) {
        try {
            const { lat, lng } = e.latlng;
            this._setView(lat, lng);
            const weatherData = await this._getWeatherData(lat, lng);
            this.#updateInfo(weatherData);
        } catch (error) {
            console.log('Error fetching data for clicked map location:', error);
        }
    }

    async _getSuggestion(e) {
        const input = search.value.trim();
        if (!input) {
            suggestionBox.innerHTML = '';
            return;
        }

        try {
            loader.style.display = 'block';
            suggestionBox.style.display = 'none';

            const cities = await this._getCitiesData(input);

            loader.style.display = 'none';
            suggestionBox.innerHTML = '';
            this.#addSuggestionHTML(cities);
            suggestionBox.style.display = 'block';
        } catch (error) {
            console.log('Error fetching city suggestions:', error);
            loader.style.display = 'none';
        }
    }

    async _getCitiesData(query) {
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&limit=10`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch city data');
        return await response.json();
    }

    async _getWeatherData(lat, lon) {
        const url = `https://api.weatherapi.com/v1/forecast.json?key=${this.#apikey}&q=${lat},${lon}&aqi=no`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        return await response.json();
    }

    async _suggestionEvent(e) {
        e.preventDefault();
        const { lat, lon } = e.target.dataset;

        try {
            const weatherData = await this._getWeatherData(lat, lon);
            this.#updateInfo(weatherData);
            suggestionBox.style.display = 'none';
        } catch (error) {
            console.log('Error processing suggestion event:', error);
        }
    }

    #updateInfo(weatherData) {
        const { name, lat, lon, localtime_epoch } = weatherData.location;
        const { temp_c, condition } = weatherData.current;

        this._setMarker(lat, lon, name);
        infoContainer.style.display = 'block';

        cityName.textContent = name;
        weatherInfo.textContent = `${temp_c}°C`;
        weatherIcon.src = `https:${condition.icon}`;
        dateTime.textContent = this.#formatDateTime(localtime_epoch);

        const currentInfo = {
            name,
            temp: temp_c,
            coords: { lat, lon },
            icon: condition.icon,
            status: condition.text,
            dateTime: this.#formatDateTime(localtime_epoch)
        };

        if (!this.#pastSearches.some((entry) => entry.name === name)) {
            this.#pastSearches.push(currentInfo);
            this._updateHistory();
        }
        this._setlocalStorage();
    }

    #formatDateTime(epoch) {
        const date = new Date(epoch * 1000);
        const options = { day: 'numeric', month: 'long' };
        const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
        const formattedTime = new Intl.DateTimeFormat('en-US', timeOptions).format(date);
        return `${formattedDate} at ${formattedTime}`;
    }

    #addSuggestionHTML(cities) {
        cities.forEach((city) => {
            const suggestion = document.createElement('li');
            suggestion.textContent = city.display_name;
            suggestion.dataset.lat = city.lat;
            suggestion.dataset.lon = city.lon;
            suggestion.addEventListener('click', this._suggestionEvent.bind(this));
            suggestionBox.insertAdjacentElement('afterbegin', suggestion);
        });
        suggestionBox.style.display = 'block';
    }

    _updateHistory() {
        if (this.#pastSearches.length === 0) return;
        historyContainer.innerHTML = '';
        let curr = 1;
        this.#pastSearches.forEach((data) => {
            const html = `<li class="city-container" data-id=${curr++}>
                  <div class="past-city-name-image-container">
                    <p class="past-city-name">${data.name}</p>
                    <div class="past-city-image-status-container">
                      <img src="https:${data.icon}">
                      <p class="past-status">${data.status}</p>
                    </div>
                  </div>
                  <div class="past-weather-data-time-container">
                    <p class="past-weather-data">${data.temp}&deg;C</p>
                    <p class="past-time">${data.dateTime}</p>
                  </div>
                </li>`;
            historyContainer.insertAdjacentHTML('afterbegin', html);
        });
    }

    _pastClickEvent(e) {
        const clicked = e.target.closest('.city-container');
        if (!clicked) return;
        const { lat, lon } = this.#pastSearches[clicked.dataset.id-1].coords;
        this._setView(lat, lon);
    }

    async _clearHistory() {
        this.#pastSearches = [];
        this._updateHistory();
        this.#clearMarkers();
        this._setlocalStorage();
        historyContainer.innerHTML = '';
    }

    #clearMarkers() {
        this.#markers.forEach(({ marker }) => this.#map.removeLayer(marker));
        this.#markers = [];
    }

    async _inputAnimation(){
        search.classList.add('search-animation');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    _setlocalStorage() {
        localStorage.setItem('history', JSON.stringify(this.#pastSearches));
        localStorage.setItem('markers', JSON.stringify(this.#markers.map(({ marker, city }) => ({
            latitude: marker.getLatLng().lat,
            longitude: marker.getLatLng().lng,
            city
        }))));
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('history'));
        const markersData = JSON.parse(localStorage.getItem('markers'));
        if (data) {
            this.#pastSearches = data;
            this._updateHistory();
        }
        if (markersData) {
            markersData.forEach(({ latitude, longitude, city }) => {
                this._setMarker(latitude, longitude, city);
            });
        }
    }
}

const weatherApp = new App();