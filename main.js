let map;
let myDataGroup = new ol.layer.Group({
    title: 'My Data',
    fold: true,
    layers: []
});

// Global object to store track data for multiple GPX files
let globalTrackData = {};

// Initialize window.filterVectorLayers globally
window.filterVectorLayers = window.filterVectorLayers || [];

// Haversine formula to calculate distance between two points
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Convert UTC time to IST
function convertToIST(utcStr) {
    if (!utcStr) return 'N/A';
    const date = new Date(utcStr);
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date).replace(",", "");
}

// Format IST time for display
function formatIST(utcStr) {
    if (!utcStr) return 'N/A';
    const d = new Date(utcStr);
    return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}, ${convertToIST(utcStr).split(' ')[1]}`;
}

// Process GPX file content and generate summary
function processGPXContent(content, layerTitle) {
    const parser = new DOMParser();
    const gpx = parser.parseFromString(content, "application/xml");

    const trkpts = Array.from(gpx.getElementsByTagName("trkpt"));
    const rtepts = Array.from(gpx.getElementsByTagName("rtept"));
    const wpts = Array.from(gpx.getElementsByTagName("wpt"));

    const features = [];
    const lineCoords = [];
    const times = [], speeds = [], elevations = [];
    const trackPoints = [];
    let totalDistance = 0;

    for (let i = 0; i < trkpts.length; i++) {
        const pt = trkpts[i];
        const lat = parseFloat(pt.getAttribute("lat"));
        const lon = parseFloat(pt.getAttribute("lon"));
        const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || 0);
        const timeStr = pt.getElementsByTagName("time")[0]?.textContent || null;

        elevations.push(ele);
        if (timeStr) times.push(new Date(timeStr));

        let speed = 0;
        if (i > 0 && timeStr) {
            const prev = trkpts[i - 1];
            const prevTimeStr = prev.getElementsByTagName("time")[0]?.textContent;
            const prevLat = parseFloat(prev.getAttribute("lat"));
            const prevLon = parseFloat(prev.getAttribute("lon"));

            const dist = haversine(prevLat, prevLon, lat, lon);
            totalDistance += dist;

            const timeDiff = (new Date(timeStr) - new Date(prevTimeStr)) / 1000;
            if (timeDiff > 0) speed = (dist / timeDiff) * 3.6; // Convert to km/h
        }

        speeds.push(speed);
        lineCoords.push([lon, lat]);

        const trackPoint = {
            lat: +lat.toFixed(10),
            lon: +lon.toFixed(10),
            elevation: +ele.toFixed(2),
            time: timeStr,
            istTime: convertToIST(timeStr),
            speed: +speed.toFixed(2)
        };
        trackPoints.push(trackPoint);

        features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: trackPoint
        });
    }

    if (lineCoords.length > 1) {
        features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: lineCoords },
            properties: { type: "track" }
        });
    }

    const geojson = {
        type: "FeatureCollection",
        features
    };

    // Calculate summary
    const start = times[0];
    const end = times[times.length - 1];
    const minEle = Math.min(...elevations).toFixed(2);
    const maxEle = Math.max(...elevations).toFixed(2);
    const minSpd = Math.min(...speeds).toFixed(2);
    const maxSpd = Math.max(...speeds).toFixed(2);
    const avgSpd = (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(2);
    const totalDist = (totalDistance / 1000).toFixed(2);

    const summaryHTML = `
        <strong>${layerTitle}</strong>:<br>
        Tracks: ${trkpts.length > 0 ? 1 : 0}<br>
        Routes: ${rtepts.length}<br>
        Waypoints: ${wpts.length}<br>
        Track Points: ${trkpts.length}<br>
        Start Time (IST): ${start ? formatIST(start) : 'N/A'}<br>
        End Time (IST): ${end ? formatIST(end) : 'N/A'}<br>
        Elevation (min → max): ${minEle} m → ${maxEle} m<br>
        Distance: ${totalDist} km<br>
        Speed (km/h):<br>
        Min: ${minSpd}<br>
        Max: ${maxSpd}<br>
        Average: ${avgSpd}<br>
    `;

    const summaryText = `Tracks: ${trkpts.length > 0 ? 1 : 0}
Routes: ${rtepts.length}
Waypoints: ${wpts.length}
Track Points: ${trkpts.length}
Start Time (IST): ${start ? formatIST(start) : 'N/A'}
End Time (IST): ${end ? formatIST(end) : 'N/A'}
Elevation (min → max): ${minEle} m → ${maxEle} m
Distance: ${totalDist} km
Speed (km/h): Min: ${minSpd}, Max: ${maxSpd}, Average: ${avgSpd}`;

    globalTrackData[layerTitle] = {
        trackPoints,
        summaryHTML,
        summaryText
    };

    return { geojson, summaryHTML };
}

// Update GPX summaries in #summary div
function updateGPXSummaries() {
    const summaryDiv = document.getElementById('summary');
    const summaries = Object.values(globalTrackData).map(data => data.summaryHTML).join('<hr>');
    summaryDiv.innerHTML = summaries || 'No GPX files loaded.';
    document.getElementById('downloadKML').disabled = Object.keys(globalTrackData).length === 0 && window.filterVectorLayers.length === 0;
}

// KML download function for GPX and filtered layers
function downloadKML() {
    console.log('Entering downloadKML (main.js)');
    console.log('globalTrackData:', window.globalTrackData);
    console.log('window.filterVectorLayers:', window.filterVectorLayers);

    // Ensure globals are initialized
    window.globalTrackData = window.globalTrackData || {};
    window.filterVectorLayers = window.filterVectorLayers || [];

    const availableLayers = [];
    Object.keys(window.globalTrackData).forEach(title => availableLayers.push({ type: 'gpx', title }));
    if (Array.isArray(window.filterVectorLayers)) {
        window.filterVectorLayers.forEach(layer => availableLayers.push({ type: 'filtered', title: layer.get('title') }));
    } else {
        console.warn('window.filterVectorLayers is not an array:', window.filterVectorLayers);
    }

    if (availableLayers.length === 0) {
        alert('No data available to download.');
        return;
    }

    let layerTitle = availableLayers[0].title;
    if (availableLayers.length > 1) {
        layerTitle = prompt('Enter the layer name to export as KML:', availableLayers[0].title);
        if (!layerTitle || !availableLayers.some(l => l.title === layerTitle)) {
            alert('Invalid or no layer selected.');
            return;
        }
    }

    let filename = prompt(`Enter filename for KML (without extension) for ${layerTitle}:`, layerTitle);
    if (!filename) return;
    filename = filename.trim() + ".kml";

    const layerType = availableLayers.find(l => l.title === layerTitle).type;

    if (layerType === 'gpx') {
        const { trackPoints, summaryText } = window.globalTrackData[layerTitle] || {};
        if (!trackPoints) {
            alert('No track data available for the selected GPX layer.');
            return;
        }
        const coordinatesString = trackPoints.map(pt => `${pt.lon},${pt.lat},${pt.elevation || 0}`).join(" ");
        const kmlParts = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>`,
            `<Folder><name>Track Summary</name>`,
            `<Placemark><description><![CDATA[${summaryText.replace(/\n/g, "<br>")}]]></description>`,
            `<LineString><coordinates>${coordinatesString}</coordinates></LineString>`,
            `</Placemark></Folder>`,
            `<Folder><name>Track Points</name>`
        ];

        for (const pt of trackPoints) {
            kmlParts.push(`
                <Placemark>
                    <description><![CDATA[
"lat": ${pt.lat},<br>
"lon": ${pt.lon},<br>
"elevation": ${pt.elevation || 'N/A'},<br>
"time": "${pt.time || 'N/A'}",<br>
"istTime": "${pt.istTime || 'N/A'}",<br>
"speed": ${pt.speed || 'N/A'}
                    ]]></description>
                    <Point><coordinates>${pt.lon},${pt.lat},${pt.elevation || 0}</coordinates></Point>
                </Placemark>`);
        }

        kmlParts.push(`</Folder></Document></kml>`);
        const blob = new Blob([kmlParts.join("")], { type: "application/vnd.google-earth.kml+xml" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else if (layerType === 'filtered') {
        const layer = window.filterVectorLayers.find(l => l.get('title') === layerTitle);
        if (!layer) {
            alert('Selected layer not found.');
            return;
        }

        const features = layer.getSource().getFeatures();
        const kmlParts = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>`,
            `<Folder><name>${layerTitle}</name>`
        ];

        features.forEach(feature => {
            const geometry = feature.getGeometry();
            const properties = feature.getProperties();
            delete properties.geometry;
            const description = Object.entries(properties)
                .map(([key, value]) => `${key}: ${value || 'N/A'}`)
                .join('<br>');
            let coordinates;

            if (geometry.getType() === 'Point') {
                const coords = geometry.getCoordinates();
                const lonLat = ol.proj.toLonLat(coords);
                coordinates = `${lonLat[0]},${lonLat[1]},0`;
                kmlParts.push(`
                    <Placemark>
                        <description><![CDATA[${description}]]></description>
                        <Point><coordinates>${coordinates}</coordinates></Point>
                    </Placemark>`);
            } else if (geometry.getType() === 'LineString') {
                const coords = geometry.getCoordinates();
                coordinates = coords.map(c => {
                    const lonLat = ol.proj.toLonLat(c);
                    return `${lonLat[0]},${lonLat[1]},0`;
                }).join(" ");
                kmlParts.push(`
                    <Placemark>
                        <description><![CDATA[${description}]]></description>
                        <LineString><coordinates>${coordinates}</coordinates></LineString>
                    </Placemark>`);
            } else if (geometry.getType() === 'Polygon') {
                const coords = geometry.getCoordinates()[0];
                coordinates = coords.map(c => {
                    const lonLat = ol.proj.toLonLat(c);
                    return `${lonLat[0]},${lonLat[1]},0`;
                }).join(" ");
                kmlParts.push(`
                    <Placemark>
                        <description><![CDATA[${description}]]></description>
                        <Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>
                    </Placemark>`);
            }
        });

        kmlParts.push(`</Folder></Document></kml>`);
        const blob = new Blob([kmlParts.join("")], { type: "application/vnd.google-earth.kml+xml" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Process KML or GPX file content
function processFileContent(content, format, layerTitle) {
    // Ensure window.filterVectorLayers is initialized
    window.filterVectorLayers = window.filterVectorLayers || [];
    console.log('Processing file:', layerTitle, 'Format:', format);

    let features;
    try {
        if (format === 'kml') {
            const kmlFormat = new ol.format.KML({
                extractStyles: true,
                defaultStyle: [new ol.style.Style({
                    fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.4)' }),
                    stroke: new ol.style.Stroke({ color: '#3399CC', width: 1.25 }),
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: new ol.style.Fill({ color: '#3399CC' }),
                        stroke: new ol.style.Stroke({ color: '#000', width: 1 })
                    })
                })]
            });
            features = kmlFormat.readFeatures(content, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        } else if (format === 'gpx') {
            if (!content.includes('<gpx')) throw new Error('Invalid GPX file: Missing <gpx> tag');
            const { geojson } = processGPXContent(content, layerTitle);
            features = new ol.format.GeoJSON().readFeatures(geojson, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        }
    } catch (err) {
        throw new Error(`Failed to parse ${format.toUpperCase()} file: ${err.message}`);
    }

    if (!features || features.length === 0) {
        alert(`No valid features found in the ${format.toUpperCase()} file: ${layerTitle}`);
        return false;
    }

    let newLayer;
    if (format === 'gpx') {
        const pointFeatures = features.filter(f => f.getGeometry().getType() === 'Point');
        const lineFeatures = features.filter(f => f.getGeometry().getType() === 'LineString');

        const pointLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: pointFeatures }),
            title: `${layerTitle} Points`,
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 4,
                    fill: new ol.style.Fill({ color: 'blue' }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 1 })
                })
            })
        });

        const lineLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: lineFeatures }),
            title: `${layerTitle} Track`,
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({ color: 'red', width: 3 })
            })
        });

        newLayer = new ol.layer.Group({
            title: layerTitle,
            layers: [lineLayer, pointLayer]
        });
    } else {
        newLayer = new ol.layer.Vector({
            source: new ol.source.Vector({ features: features }),
            title: layerTitle
        });
    }

    myDataGroup.getLayers().push(newLayer);
    window.filterVectorLayers.push(newLayer);

    const extent = newLayer.get('source') ? newLayer.getSource().getExtent() : ol.extent.createEmpty();
    if (format === 'gpx') {
        newLayer.getLayers().forEach(layer => {
            const layerExtent = layer.getSource().getExtent();
            if (!ol.extent.isEmpty(layerExtent)) {
                ol.extent.extend(extent, layerExtent);
            }
        });
    }

    if (!ol.extent.isEmpty(extent)) {
        map.getView().fit(extent, {
            padding: [20, 20, 20, 20],
            minZoom: 10,
            maxZoom: 15,
            duration: 1000
        });
    } else {
        console.warn(`Empty extent for layer: ${layerTitle}`);
    }

    if (format === 'gpx') updateGPXSummaries();
    debouncedRenderPanel();
    return true;
}

// Initialize map view
const mapView = new ol.View({
    center: ol.proj.fromLonLat([78.776032, 23.766398]),
    zoom: 4.5
});

// Create map
map = new ol.Map({
    target: 'map',
    view: mapView,
    controls: []
});
window.map = map; // Expose map globally for filter functions

// Base layers
const noneTile = new ol.layer.Tile({
    title: 'None',
    type: 'base',
    visible: false
});

const osmTile = new ol.layer.Tile({
    title: 'Open Street Map',
    visible: true,
    type: 'base',
    source: new ol.source.OSM()
});

const baseGroup = new ol.layer.Group({
    title: 'Base Maps',
    fold: true,
    layers: [osmTile, noneTile]
});

map.addLayer(baseGroup);

// WFS: India Districts
const IndiaDsVector = new ol.layer.Vector({
    title: "India Districts (WFS)",
    source: new ol.source.Vector({
        url: 'http://localhost:8080/geoserver/rana/ows?' +
             'service=WFS&version=1.1.0&request=GetFeature' +
             '&typeName=rana:district_boundary&outputFormat=application/json',
        format: new ol.format.GeoJSON()
    }),
    visible: true
});

// WFS: India States
const IndiaStVector = new ol.layer.Vector({
    title: "India States (WFS)",
    source: new ol.source.Vector({
        url: 'http://localhost:8080/geoserver/rana/ows?' +
             'service=WFS&version=1.1.0&request=GetFeature' +
             '&typeName=rana:stateboundary&outputFormat=application/json',
        format: new ol.format.GeoJSON()
    }),
    visible: true
});

// Updated overlay group with WFS layers
const overlayGroup = new ol.layer.Group({
    title: 'Overlays',
    fold: true,
    layers: [IndiaDsVector, IndiaStVector]
});

map.addLayer(overlayGroup);

// Add myDataGroup
window.myDataGroup = myDataGroup; // Expose myDataGroup globally
map.addLayer(myDataGroup);

// Debounce function for layer switcher rendering
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.debouncedRenderPanel = debounce(() => {
    layerSwitcher.renderPanel();
}, 100); // Expose for global access

// Layer switcher control
const layerSwitcher = new ol.control.LayerSwitcher({
    activationMode: 'click',
    startActive: false,
    groupSelectStyle: 'children',
    tipLabel: 'Toggle Layers'
});

map.addControl(layerSwitcher);

// Handle layer switcher clicks and context menu
document.addEventListener('contextmenu', (event) => {
    const target = event.target.closest('.layer-switcher label');
    if (target) {
        event.preventDefault();
        const input = target.querySelector('input[type="checkbox"]');
        if (input) {
            const layerTitle = target.textContent.trim();
            const layer = window.filterVectorLayers.find(l => l.get('title') === layerTitle);
            if (layer) {
                document.getElementById('selectedLayer').value = layerTitle;
                document.getElementById('selectedStyleLayer').value = layerTitle;
                const layerManagementPanel = document.getElementById('layerManagementPanel');
                layerManagementPanel.style.left = (event.pageX + 10) + 'px';
                layerManagementPanel.style.top = (event.pageY - 10) + 'px';
                layerManagementPanel.classList.add('show');
            }
        }
    }
}, false);

document.addEventListener('click', (event) => {
    const layerManagementPanel = document.getElementById('layerManagementPanel');
    const stylePanel = document.getElementById('stylePanel');
    if (!layerManagementPanel.contains(event.target) && !stylePanel.contains(event.target)) {
        layerManagementPanel.classList.remove('show');
        stylePanel.classList.remove('show');
    }
});

// Handle double-click for style customization
document.addEventListener('dblclick', (event) => {
    const target = event.target.closest('.layer-switcher label');
    if (target) {
        event.preventDefault();
        const input = target.querySelector('input[type="checkbox"]');
        if (input) {
            const layerTitle = target.textContent.trim();
            const layer = window.filterVectorLayers.find(l => l.get('title') === layerTitle);
            if (layer && layer instanceof ol.layer.Vector) { // Only for vector layers
                document.getElementById('selectedStyleLayer').value = layerTitle;
                const style = layer.getStyle();
                if (style && typeof style === 'function') return; // Skip if style is a function
                const strokeColor = style?.getStroke()?.getColor() || '#000000';
                const fillColor = style?.getFill()?.getColor() || '#000000';
                const pointColor = style?.getImage()?.getFill()?.getColor() || '#000000';
                document.getElementById('strokeColor').value = rgbToHex(strokeColor);
                document.getElementById('fillColor').value = rgbToHex(fillColor);
                document.getElementById('pointColor').value = rgbToHex(pointColor);
                const stylePanel = document.getElementById('stylePanel');
                stylePanel.style.left = (event.pageX + 10) + 'px';
                stylePanel.style.top = (event.pageY - 10) + 'px';
                stylePanel.classList.add('show');
            }
        }
    }
}, false);

// Convert RGB(A) to Hex
function rgbToHex(color) {
    if (typeof color === 'string') {
        const match = color.match(/\d+/g);
        if (match) {
            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        }
    }
    return '#000000';
}

// Mouse position control
const mousePosition = new ol.control.MousePosition({
    className: 'mousePosition',
    projection: 'EPSG:4326',
    coordinateFormat: coordinate => ol.coordinate.format(coordinate, '{y}, {x}', 4)
});
map.addControl(mousePosition);

// Scale line control
const scaleControl = new ol.control.ScaleLine({
    bar: true,
    text: true
});
map.addControl(scaleControl);

// Popup overlay
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const popup = new ol.Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
});

map.addOverlay(popup);

closer.onclick = () => {
    popup.setPosition(undefined);
    closer.blur();
    return false;
};

// Home control
const homeButton = document.createElement('button');
homeButton.innerHTML = '<img src="resources/images/home.svg" alt="Home" style="width:20px;height:20px;filter:brightness(0) invert(1);vertical-align:middle">';
homeButton.className = 'myButton';
const homeElement = document.createElement('div');
homeElement.className = 'homeButtonDiv';
homeElement.appendChild(homeButton);
const homeControl = new ol.control.Control({ element: homeElement });
homeButton.addEventListener('click', () => location.href = 'index.html');
map.addControl(homeControl);

// Full screen control
const fsButton = document.createElement('button');
fsButton.innerHTML = '<img src="resources/images/fullscreen.svg" alt="Full Screen" style="width:20px;height:20px;filter:brightness(0) invert(1);vertical-align:middle">';
fsButton.className = 'myButton';
const fsElement = document.createElement('div');
fsElement.className = 'fsButtonDiv';
fsElement.appendChild(fsButton);
const fsControl = new ol.control.Control({ element: fsElement });
fsButton.addEventListener('click', () => {
    const mapEle = document.getElementById('map');
    if (mapEle.requestFullscreen) mapEle.requestFullscreen();
    else if (mapEle.msRequestFullscreen) mapEle.msRequestFullscreen();
    else if (mapEle.mozRequestFullscreen) mapEle.mozRequestFullscreen();
    else if (mapEle.webkitRequestFullscreen) mapEle.webkitRequestFullscreen();
});
map.addControl(fsControl);

// Zoom in control
const zoomInInteraction = new ol.interaction.DragBox();
zoomInInteraction.on('boxend', () => {
    const zoomInExtent = zoomInInteraction.getGeometry().getExtent();
    map.getView().fit(zoomInExtent);
});
const ziButton = document.createElement('button');
ziButton.innerHTML = '<img src="resources/images/zoomIn.svg" alt="Zoom In" style="width:18px;height:18px;transform: rotate(270deg);filter:brightness(0) invert(1);vertical-align:middle">';
ziButton.className = 'myButton';
ziButton.id = 'ziButton';
const ziElement = document.createElement('div');
ziElement.className = 'ziButtonDiv';
ziElement.appendChild(ziButton);
const ziControl = new ol.control.Control({ element: ziElement });
let zoomInFlag = false;
ziButton.addEventListener('click', () => {
    ziButton.classList.toggle('clicked');
    zoomInFlag = !zoomInFlag;
    document.getElementById('map').style.cursor = zoomInFlag ? 'zoom-in' : 'default';
    if (zoomInFlag) map.addInteraction(zoomInInteraction);
    else map.removeInteraction(zoomInInteraction);
});
map.addControl(ziControl);

// Zoom out control
const zoomOutInteraction = new ol.interaction.DragBox();
zoomOutInteraction.on('boxend', () => {
    const zoomOutExtent = zoomOutInteraction.getGeometry().getExtent();
    map.getView().setCenter(ol.extent.getCenter(zoomOutExtent));
    mapView.setZoom(mapView.getZoom() - 1);
});
const zoButton = document.createElement('button');
zoButton.innerHTML = '<img src="resources/images/zoomOut.png" alt="Zoom Out" style="width:18px;height:18px;transform: rotate(270deg);filter:brightness(0) invert(1);vertical-align:middle">';
zoButton.className = 'myButton';
zoButton.id = 'zoButton';
const zoElement = document.createElement('div');
zoElement.className = 'zoButtonDiv';
zoElement.appendChild(zoButton);
const zoControl = new ol.control.Control({ element: zoElement });
let zoomOutFlag = false;
zoButton.addEventListener('click', () => {
    zoButton.classList.toggle('clicked');
    zoomOutFlag = !zoomOutFlag;
    document.getElementById('map').style.cursor = zoomOutFlag ? 'zoom-out' : 'default';
    if (zoomOutFlag) map.addInteraction(zoomOutInteraction);
    else map.removeInteraction(zoomOutInteraction);
});
map.addControl(zoControl);

// Feature info control
const featureInfoButton = document.createElement('button');
featureInfoButton.innerHTML = '<img src="resources/images/identify.svg" alt="Feature Info" style="width:20px;height:20px;filter:brightness(0) invert(1);vertical-align:middle">';
featureInfoButton.className = 'myButton';
featureInfoButton.id = 'featureInfoButton';
const featureInfoElement = document.createElement('div');
featureInfoElement.className = 'featureInfoDiv';
featureInfoElement.appendChild(featureInfoButton);
const featureInfoControl = new ol.control.Control({ element: featureInfoElement });
let featureInfoFlag = false;
featureInfoButton.addEventListener('click', () => {
    featureInfoButton.classList.toggle('clicked');
    featureInfoFlag = !featureInfoFlag;
    console.log('Feature Info Flag:', featureInfoFlag);
});
map.addControl(featureInfoControl);

// Modified feature info click handler to support GPX, KML, and KMZ properties
map.on('singleclick', evt => {
    if (!featureInfoFlag) {
        console.log('Feature info not active. Click the Feature Info button to enable.');
        return;
    }

    content.innerHTML = '';
    let featureFound = false;

    console.log('Click coordinates:', evt.coordinate);

    // Check features in myDataGroup (GPX, KML, KMZ layers)
    map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
        if (featureFound) return; // Process only the first feature found
        if (layer && layer.get('title') && myDataGroup.getLayers().getArray().some(l => l === layer || (l instanceof ol.layer.Group && l.getLayers().getArray().includes(layer)))) {
            const props = feature.getProperties();
            console.log('Feature found in layer:', layer.get('title'), 'Properties:', props);

            let html = `<h3>${layer.get('title')}</h3>`;
            if (props.lat && props.lon) { // GPX-specific properties
                html += `
                    <p><strong>Lat:</strong> ${props.lat}</p>
                    <p><strong>Lon:</strong> ${props.lon}</p>
                    <p><strong>Elevation:</strong> ${props.elevation || 'N/A'} m</p>
                    <p><strong>Time (IST):</strong> ${props.istTime || 'N/A'}</p>
                    <p><strong>Speed:</strong> ${props.speed || 'N/A'} km/h</p>`;
            } else { // KML/KMZ or other properties
                for (const key in props) {
                    if (key !== 'geometry') {
                        let value = props[key];
                        // Handle KML description field
                        if (key === 'description' && typeof value === 'string') {
                            try {
                                // Attempt to parse description as HTML or key-value pairs
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(value, 'text/html');
                                const textContent = doc.body.textContent || value;
                                value = textContent.split('\n').map(line => line.trim()).filter(line => line).join('<br>');
                            } catch (e) {
                                console.warn('Failed to parse KML description:', e);
                            }
                        }
                        html += `<p><strong>${key}:</strong> ${value || 'N/A'}</p>`;
                    }
                }
            }
            content.innerHTML = html;
            popup.setPosition(evt.coordinate);
            featureFound = true;
        }
    }, {
        hitTolerance: 5, // Add tolerance for easier feature selection
        layerFilter: layer => myDataGroup.getLayers().getArray().some(l => l === layer || (l instanceof ol.layer.Group && l.getLayers().getArray().includes(layer)))
    });

    // Fallback to WFS layers if no features found in myDataGroup
    if (!featureFound) {
        const resolution = mapView.getResolution();
        const url = IndiaDsVector.getSource().getFeatureInfoUrl(evt.coordinate, resolution, 'EPSG:3857', {
            'INFO_FORMAT': 'application/json',
            'propertyName': 'state,district'
        });
        if (url) {
            $.getJSON(url, data => {
                if (data.features && data.features.length > 0) {
                    const props = data.features[0].properties;
                    console.log('WFS feature found:', props);
                    content.innerHTML = `<h3>India Districts</h3><p><strong>State:</strong> ${props.state.toUpperCase()}</p><p><strong>District:</strong> ${props.district.toUpperCase()}</p>`;
                    popup.setPosition(evt.coordinate);
                } else {
                    console.log('No WFS features found at coordinate.');
                    popup.setPosition(undefined);
                }
            }).fail(err => {
                console.error('WFS query failed:', err);
                popup.setPosition(undefined);
            });
        } else {
            console.log('No WFS URL generated.');
            popup.setPosition(undefined);
        }
    }
});

// Measurement controls
let draw, source = new ol.source.Vector();
const vector = new ol.layer.Vector({
    source: source,
    style: new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
        stroke: new ol.style.Stroke({ color: '#ffcc33', width: 2 }),
        image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: '#ffcc33' }) })
    })
});
map.addLayer(vector);

const lengthButton = document.createElement('button');
lengthButton.innerHTML = '<img src="resources/images/measure-length.png" alt="Measure Length" style="width:17px;height:17px;filter:brightness(0) invert(1);vertical-align:middle">';
lengthButton.className = 'myButton';
lengthButton.id = 'lengthButton';
const lengthElement = document.createElement('div');
lengthElement.className = 'lengthButtonDiv';
lengthElement.appendChild(lengthButton);
const lengthControl = new ol.control.Control({ element: lengthElement });
let lengthFlag = false;
lengthButton.addEventListener('click', () => {
    lengthButton.classList.toggle('clicked');
    lengthFlag = !lengthFlag;
    document.getElementById('map').style.cursor = 'default';
    if (lengthFlag) {
        map.removeInteraction(draw);
        addInteraction('LineString');
    } else {
        map.removeInteraction(draw);
        source.clear();
        document.querySelectorAll('.ol-tooltip.ol-tooltip-static').forEach(el => el.remove());
    }
});
map.addControl(lengthControl);

const areaButton = document.createElement('button');
areaButton.innerHTML = '<img src="resources/images/measure-area.png" alt="Measure Area" style="width:17px;height:17px;filter:brightness(0) invert(1);vertical-align:middle">';
areaButton.className = 'myButton';
areaButton.id = 'areaButton';
const areaElement = document.createElement('div');
areaElement.className = 'areaButtonDiv';
areaElement.appendChild(areaButton);
const areaControl = new ol.control.Control({ element: areaElement });
let areaFlag = false;
areaButton.addEventListener('click', () => {
    areaButton.classList.toggle('clicked');
    areaFlag = !areaFlag;
    document.getElementById('map').style.cursor = 'default';
    if (areaFlag) {
        map.removeInteraction(draw);
        addInteraction('Polygon');
    } else {
        map.removeInteraction(draw);
        source.clear();
        document.querySelectorAll('.ol-tooltip.ol-tooltip-static').forEach(el => el.remove());
    }
});
map.addControl(areaControl);

// Upload KML/KMZ/GPX control
const uploadKmlButton = document.createElement('button');
uploadKmlButton.innerHTML = '<img src="resources/images/upload.png" alt="Upload" style="width:20px;height:20px;filter:brightness(0) invert(1);vertical-align:middle">';
uploadKmlButton.className = 'myButton';
uploadKmlButton.id = 'uploadKmlButton';
const uploadKmlElement = document.createElement('div');
uploadKmlElement.className = 'uploadKmlButtonDiv';
uploadKmlElement.appendChild(uploadKmlButton);
const uploadKmlControl = new ol.control.Control({ element: uploadKmlElement });
map.addControl(uploadKmlControl);

uploadKmlButton.addEventListener('click', () => {
    document.getElementById('kmlFileInput').click();
});

document.getElementById('kmlFileInput').addEventListener('change', event => {
    const files = event.target.files;
    if (files.length === 0) return;

    let processedFiles = 0;
    const totalFiles = files.length;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        const fileName = file.name;
        const extension = fileName.split('.').pop().toLowerCase();
        const layerTitle = fileName.replace(/\.[^/.]+$/, '');

        reader.onload = function(e) {
            try {
                if (extension === 'kmz') {
                    JSZip.loadAsync(file).then(zip => {
                        const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
                        if (!kmlFile) throw new Error('No KML file found in KMZ');
                        return zip.file(kmlFile).async('string');
                    }).then(kmlContent => {
                        if (processFileContent(kmlContent, 'kml', layerTitle)) {
                            processedFiles++;
                            if (processedFiles === totalFiles) {
                                debouncedRenderPanel();
                            }
                        }
                    }).catch(err => {
                        console.error(`Error processing KMZ (${fileName}):`, err);
                        alert(`Failed to process KMZ file ${fileName}: ${err.message}`);
                        processedFiles++;
                        if (processedFiles === totalFiles) {
                            debouncedRenderPanel();
                        }
                    });
                } else if (extension === 'kml') {
                    if (processFileContent(e.target.result, 'kml', layerTitle)) {
                        processedFiles++;
                        if (processedFiles === totalFiles) {
                            debouncedRenderPanel();
                        }
                    }
                } else if (extension === 'gpx') {
                    if (!e.target.result.includes('<gpx')) throw new Error('Invalid GPX file: Missing <gpx> tag');
                    if (processFileContent(e.target.result, 'gpx', layerTitle)) {
                        processedFiles++;
                        if (processedFiles === totalFiles) {
                            debouncedRenderPanel();
                        }
                    }
                } else {
                    alert(`Please upload a valid KML, KMZ, or GPX file for ${fileName}.`);
                    processedFiles++;
                    if (processedFiles === totalFiles) {
                        debancedRenderPanel();
                    }
                }
            } catch (err) {
                console.error(`Error reading file ${fileName}:`, err);
                alert(`Error reading file ${fileName}: ${err.message}`);
                processedFiles++;
                if (processedFiles === totalFiles) {
                    debouncedRenderPanel();
                }
            }
        };

        if (extension === 'kml' || extension === 'gpx') reader.readAsText(file);
        else if (extension === 'kmz') reader.readAsArrayBuffer(file);
    });
});

// Add downloadKML event listener
document.getElementById('downloadKML').addEventListener('click', downloadKML);

// Measurement functions
const continuePolygonMsg = 'Click to continue polygon, Double click to complete';
const continueLineMsg = 'Click to continue line, Double click to complete';

function addInteraction(intType) {
    draw = new ol.interaction.Draw({
        source: source,
        type: intType,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(200, 200, 200, 0.6)' }),
            stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.5)', lineDash: [10, 10], width: 2 }),
            image: new ol.style.Circle({
                radius: 5,
                stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' })
            })
        })
    });
    map.addInteraction(draw);

    createMeasureTooltip();
    createHelpTooltip();

    let sketch;
    const pointerMoveHandler = evt => {
        if (evt.dragging) return;
        const helpMsg = 'Click to start drawing';
        if (sketch) {
            helpTooltipElement.innerHTML = intType === 'Polygon' ? continuePolygonMsg : continueLineMsg;
            helpTooltip.setPosition(evt.coordinate);
            helpTooltipElement.className = 'ol-tooltip';
        } else {
            helpTooltipElement.innerHTML = helpMsg;
            helpTooltipElement.className = 'ol-tooltip';
        }
    };

    map.on('pointermove', pointerMoveHandler);

    draw.on('drawstart', evt => {
        sketch = evt.feature;
        let tooltipCoord = evt.coordinate;
        sketch.getGeometry().on('change', evt => {
            const geom = evt.target;
            let output;
            if (geom instanceof ol.geom.Polygon) {
                output = formatArea(geom);
                tooltipCoord = geom.getInteriorPoint().getCoordinates();
            } else if (geom instanceof ol.geom.LineString) {
                output = formatLength(geom);
                tooltipCoord = geom.getLastCoordinate();
            }
            measureTooltipElement.innerHTML = output;
            measureTooltip.setPosition(tooltipCoord);
        });
    });

    draw.on('drawend', () => {
        measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
        measureTooltip.setOffset([0, -7]);
        sketch = null;
        measureTooltipElement = null;
        createMeasureTooltip();
    });
}

let helpTooltipElement, helpTooltip, measureTooltipElement, measureTooltip;

function createHelpTooltip() {
    if (helpTooltipElement) helpTooltipElement.parentNode.removeChild(helpTooltipElement);
    helpTooltipElement = document.createElement('div');
    helpTooltipElement.className = 'ol-tooltip hidden';
    helpTooltip = new ol.Overlay({
        element: helpTooltipElement,
        offset: [15, 0],
        positioning: 'center-left'
    });
    map.addOverlay(helpTooltip);
}

function createMeasureTooltip() {
    if (measureTooltipElement) measureTooltipElement.parentNode.removeChild(measureTooltipElement);
    measureTooltipElement = document.createElement('div');
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
    measureTooltip = new ol.Overlay({
        element: measureTooltipElement,
        offset: [0, -15],
        positioning: 'bottom-center'
    });
    map.addOverlay(measureTooltip);
}

function formatLength(line) {
    const length = ol.sphere.getLength(line);
    return length > 100 ? `${Math.round((length / 1000) * 100) / 100} km` : `${Math.round(length * 100) / 100} m`;
}

function formatArea(polygon) {
    const area = ol.sphere.getArea(polygon);
    return area > 10000 ? `${Math.round((area / 1000000) * 100) / 100} km<sup>2</sup>` : `${Math.round(area * 100) / 100} m<sup>2</sup>`;
}

// Attribute query
let geojson, featureOverlay;

const qryButton = document.createElement('button');
qryButton.innerHTML = '<img src="resources/images/query.svg" alt="Query" style="width:17px;height:17px;filter:brightness(0) invert(1);vertical-align:middle">';
qryButton.className = 'myButton';
qryButton.id = 'qryButton';
const qryElement = document.createElement('div');
qryElement.className = 'myButtonDiv';
qryElement.appendChild(qryButton);
const qryControl = new ol.control.Control({ element: qryElement });
let qryFlag = false;
qryButton.addEventListener('click', () => {
    qryButton.classList.toggle('clicked');
    qryFlag = !qryFlag;
    document.getElementById('map').style.cursor = qryFlag ? 'crosshair' : 'default';
    if (qryFlag) {
        map.removeInteraction(draw);
        source.clear();
        document.querySelectorAll('.ol-tooltip.ol-tooltip-static').forEach(el => el.remove());
        document.getElementById('attQueryDiv').classList.add('show');
    } else {
        document.getElementById('attQueryDiv').classList.remove('show');
        if (featureOverlay) {
            map.removeLayer(featureOverlay);
            featureOverlay = null;
        }
    }
});
map.addControl(qryControl);

// Attribute query panel handling
document.getElementById('attQryRun').addEventListener('click', () => {
    const selectedLayer = document.getElementById('selectLayer').value;
    const attribute = document.getElementById('selectAttribute').value;
    const operator = document.getElementById('selectOperator').value;
    const value = document.getElementById('enterValue').value;

    if (!selectedLayer || !attribute || !operator || !value) {
        alert('Please fill in all query fields.');
        return;
    }

    const layer = window.filterVectorLayers.find(l => l.get('title') === selectedLayer);
    if (!layer) {
        alert('Selected layer not found.');
        return;
    }

    const features = layer.getSource().getFeatures();
    const filteredFeatures = features.filter(feature => {
        const propValue = feature.get(attribute);
        if (propValue === undefined || propValue === null) return false;

        switch (operator) {
            case '=': return propValue.toString().toLowerCase() === value.toLowerCase();
            case '!=': return propValue.toString().toLowerCase() !== value.toLowerCase();
            case '>': return parseFloat(propValue) > parseFloat(value);
            case '<': return parseFloat(propValue) < parseFloat(value);
            case '>=': return parseFloat(propValue) >= parseFloat(value);
            case '<=': return parseFloat(propValue) <= parseFloat(value);
            case 'like': return propValue.toString().toLowerCase().includes(value.toLowerCase());
            default: return false;
        }
    });

    if (filteredFeatures.length === 0) {
        alert('No features match the query criteria.');
        return;
    }

    if (featureOverlay) {
        map.removeLayer(featureOverlay);
    }

    featureOverlay = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: filteredFeatures
        }),
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.4)' }),
            stroke: new ol.style.Stroke({ color: '#ffcc00', width: 2 }),
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({ color: '#ffcc00' })
            })
        }),
        title: `Filtered: ${selectedLayer}`
    });

    map.addLayer(featureOverlay);
    window.filterVectorLayers.push(featureOverlay);

    const extent = featureOverlay.getSource().getExtent();
    if (!ol.extent.isEmpty(extent)) {
        map.getView().fit(extent, {
            padding: [20, 20, 20, 20],
            minZoom: 10,
            maxZoom: 15,
            duration: 1000
        });
    }

    debouncedRenderPanel();
});

// Style panel handling
document.getElementById('applyStyle').addEventListener('click', () => {
    const selectedLayer = document.getElementById('selectedStyleLayer').value;
    const strokeColor = document.getElementById('strokeColor').value;
    const fillColor = document.getElementById('fillColor').value;
    const pointColor = document.getElementById('pointColor').value;

    const layer = window.filterVectorLayers.find(l => l.get('title') === selectedLayer);
    if (!layer) {
        alert('Selected layer not found.');
        return;
    }

    const newStyle = new ol.style.Style({
        fill: new ol.style.Fill({ color: fillColor }),
        stroke: new ol.style.Stroke({ color: strokeColor, width: 2 }),
        image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({ color: pointColor }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: 1 })
        })
    });

    layer.setStyle(newStyle);
    document.getElementById('stylePanel').classList.remove('show');
});

// Clear query results
document.getElementById('clearQuery').addEventListener('click', () => {
    if (featureOverlay) {
        map.removeLayer(featureOverlay);
        window.filterVectorLayers = window.filterVectorLayers.filter(l => l !== featureOverlay);
        featureOverlay = null;
        debouncedRenderPanel();
    }
    document.getElementById('attQueryDiv').classList.remove('show');
    qryButton.classList.remove('clicked');
    qryFlag = false;
    document.getElementById('map').style.cursor = 'default';
});

// Remove layer
document.getElementById('removeLayer').addEventListener('click', () => {
    const selectedLayer = document.getElementById('selectedLayer').value;
    const layer = window.filterVectorLayers.find(l => l.get('title') === selectedLayer);
    if (layer) {
        map.removeLayer(layer);
        window.filterVectorLayers = window.filterVectorLayers.filter(l => l !== layer);
        myDataGroup.getLayers().remove(layer);
        delete globalTrackData[selectedLayer];
        updateGPXSummaries();
        debouncedRenderPanel();
    }
    document.getElementById('layerManagementPanel').classList.remove('show');
});

// Export filtered layer as KML
document.getElementById('exportLayer').addEventListener('click', () => {
    const selectedLayer = document.getElementById('selectedLayer').value;
    document.getElementById('layerManagementPanel').classList.remove('show');
    downloadKML();
});

// Expose necessary globals
window.processFileContent = processFileContent;
window.updateGPXSummaries = updateGPXSummaries;
window.downloadKML = downloadKML;

console.log('Map initialized with all controls and interactions.');

// Ensure the layer switcher is rendered initially
layerSwitcher.renderPanel();