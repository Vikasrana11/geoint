// Initialize map view
const mapView = new ol.View({
    center: ol.proj.fromLonLat([78.776032, 23.766398]),
    zoom: 4.5
});

// Create map
const map = new ol.Map({
    target: 'map',
    view: mapView,
    controls: []
});

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

// Overlay layers
const IndiaDsTile = new ol.layer.Tile({
    title: "India Districts",
    source: new ol.source.TileWMS({
        url: 'http://localhost:8080/geoserver/GISSimplified/wms',
        params: { 'LAYERS': 'GISSimplified:india_ds', 'TILED': true },
        serverType: 'geoserver',
        visible: true
    })
});

const IndiaStTile = new ol.layer.Tile({
    title: "India States",
    source: new ol.source.TileWMS({
        url: 'http://localhost:8080/geoserver/GISSimplified/wms',
        params: { 'LAYERS': 'GISSimplified:india_st', 'TILED': true },
        serverType: 'geoserver',
        visible: true
    })
});

const overlayGroup = new ol.layer.Group({
    title: 'Overlays',
    fold: true,
    layers: [IndiaDsTile, IndiaStTile]
});

map.addLayer(overlayGroup);

// My Data group for uploaded layers
const myDataGroup = new ol.layer.Group({
    title: 'My Data',
    fold: true,
    layers: []
});

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

// Layer switcher control
const layerSwitcher = new ol.control.LayerSwitcher({
    activationMode: 'click',
    startActive: false,
    groupSelectStyle: 'children',
    tipLabel: 'Toggle Layers'
});

map.addControl(layerSwitcher);

const debouncedRenderPanel = debounce(() => {
    layerSwitcher.renderPanel();
}, 100);

// Handle layer switcher clicks
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('.layer-switcher label') || target.closest('.layer-switcher .fold')) {
        const label = target.closest('.layer-switcher label');
        const foldIcon = target.closest('.layer-switcher .fold');
        if (label) {
            const input = label.querySelector('input[type="checkbox"]');
            if (input) input.click();
        } else if (foldIcon) {
            const groupElement = foldIcon.closest('.group');
            const input = groupElement.querySelector('input[type="radio"], input[type="checkbox"]');
            if (input) input.click();
        }
    }
});

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
});
map.addControl(featureInfoControl);

map.on('singleclick', evt => {
    if (!featureInfoFlag) return;
    content.innerHTML = '';
    let featureFound = false;

    myDataGroup.getLayers().forEach(layer => {
        if (layer.getVisible()) {
            const features = layer.getSource().getFeaturesAtCoordinate(evt.coordinate);
            if (features.length > 0) {
                const feature = features[0];
                const props = feature.getProperties();
                let html = `<h3>${layer.get('title')}</h3>`;
                for (const key in props) {
                    if (key !== 'geometry') {
                        html += `<p><strong>${key}:</strong> ${props[key] || 'N/A'}</p>`;
                    }
                }
                content.innerHTML = html;
                popup.setPosition(evt.coordinate);
                featureFound = true;
            }
        }
    });

    if (!featureFound) {
        const resolution = mapView.getResolution();
        const url = IndiaDsTile.getSource().getFeatureInfoUrl(evt.coordinate, resolution, 'EPSG:3857', {
            'INFO_FORMAT': 'application/json',
            'propertyName': 'state,district'
        });
        if (url) {
            $.getJSON(url, data => {
                if (data.features && data.features.length > 0) {
                    const props = data.features[0].properties;
                    content.innerHTML = `<h3>India Districts</h3><p><strong>State:</strong> ${props.state.toUpperCase()}</p><p><strong>District:</strong> ${props.district.toUpperCase()}</p>`;
                    popup.setPosition(evt.coordinate);
                } else {
                    popup.setPosition(undefined);
                }
            }).fail(() => popup.setPosition(undefined));
        } else {
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

// Filter control
const filterButton = document.createElement('button');
filterButton.innerHTML = '<img src="resources/images/filter.svg" alt="Filter" style="width:20px;height:20px;filter:brightness(0) invert(1);vertical-align:middle">';
filterButton.className = 'myButton';
filterButton.id = 'filterButton';
const filterElement = document.createElement('div');
filterElement.className = 'filterButtonDiv';
filterElement.appendChild(filterButton);
const filterControl = new ol.control.Control({ element: filterElement });
let filterFlag = false;
filterButton.addEventListener('click', () => {
    filterButton.classList.toggle('clicked');
    filterFlag = !filterFlag;
    document.getElementById('map').style.cursor = 'default';
    const filterPanel = document.getElementById('dateFilterPanel');
    filterPanel.style.display = filterFlag ? 'flex' : 'none';
});
map.addControl(filterControl);

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
    const file = event.target.files[0];
    if (!file) return;

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
                    processFileContent(kmlContent, 'kml', layerTitle);
                }).catch(err => {
                    console.error('Error processing KMZ:', err);
                    alert('Failed to process KMZ file: ' + err.message);
                });
            } else if (extension === 'kml') {
                processFileContent(e.target.result, 'kml', layerTitle);
            } else if (extension === 'gpx') {
                if (!e.target.result.includes('<gpx')) throw new Error('Invalid GPX file: Missing <gpx> tag');
                processFileContent(e.target.result, 'gpx', layerTitle);
            } else {
                alert('Please upload a valid KML, KMZ, or GPX file.');
            }
        } catch (err) {
            console.error('Error reading file:', err);
            alert('Error reading file: ' + err.message);
        }
    };

    if (extension === 'kml' || extension === 'gpx') reader.readAsText(file);
    else if (extension === 'kmz') reader.readAsArrayBuffer(file);
});

function processFileContent(content, format, layerTitle) {
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
            const gpxFormat = new ol.format.GPX();
            features = gpxFormat.readFeatures(content, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
        }
    } catch (err) {
        throw new Error(`Failed to parse ${format.toUpperCase()} file: ${err.message}`);
    }

    if (!features || features.length === 0) {
        alert(`No valid features found in the ${format.toUpperCase()} file.`);
        return;
    }

    const newLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: features }),
        title: layerTitle
    });

    myDataGroup.getLayers().push(newLayer);

    const extent = newLayer.getSource().getExtent();
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

    debouncedRenderPanel();
}

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
    document.getElementById('map').style.cursor = 'default';
    const attQueryDiv = document.getElementById('attQueryDiv');
    const attListDiv = document.getElementById('attListDiv');
    if (qryFlag) {
        if (geojson) {
            geojson.getSource().clear();
            map.removeLayer(geojson);
        }
        if (featureOverlay) {
            featureOverlay.getSource().clear();
            map.removeLayer(featureOverlay);
        }
        attQueryDiv.style.display = 'block';
        addMapLayerList();
    } else {
        attQueryDiv.style.display = 'none';
        attListDiv.style.display = 'none';
        if (geojson) {
            geojson.getSource().clear();
            map.removeLayer(geojson);
        }
        if (featureOverlay) {
            featureOverlay.getSource().clear();
            map.removeLayer(featureOverlay);
        }
    }
});
map.addControl(qryControl);

function addMapLayerList() {
    $.ajax({
        type: 'GET',
        url: 'http://localhost:8080/geoserver/wfs?request=getCapabilities',
        dataType: 'xml',
        success: xml => {
            const select = $('#selectLayer');
            select.empty().append("<option value=''></option>");
            $(xml).find('FeatureType').each(function() {
                $(this).find('Name').each(function() {
                    const value = $(this).text();
                    select.append(`<option value='${value}'>${value}</option>`);
                });
            });
        },
        error: err => {
            console.error('Failed to load layers:', err);
            alert('Could not load layers. Please try again.');
        }
    });
}

$(function() {
    $('#selectLayer').on('change', function() {
        const select = $('#selectAttribute');
        select.empty().append("<option value=''></option>");
        const value_layer = $(this).val();
        $.ajax({
            type: 'GET',
            url: `http://localhost:8080/geoserver/wfs?service=WFS&request=DescribeFeatureType&version=1.1.0&typeName=${value_layer}`,
            dataType: 'xml',
            success: xml => {
                $(xml).find('xsd\\:sequence').each(function() {
                    $(this).find('xsd\\:element').each(function() {
                        const value = $(this).attr('name');
                        const type = $(this).attr('type');
                        if (value !== 'geom' && value !== 'the_geom') {
                            select.append(`<option value='${type}'>${value}</option>`);
                        }
                    });
                });
            },
            error: err => {
                console.error('Failed to load attributes:', err);
                alert('Could not load attributes. Please try again.');
            }
        });
    });

    $('#selectAttribute').on('change', function() {
        const operator = $('#selectOperator');
        operator.empty().append("<option value=''>Select operator</option>");
        const value_type = $(this).val();
        if (value_type === 'xsd:short' || value_type === 'xsd:int' || value_type === 'xsd:double') {
            operator.append("<option value='>'>Greater than</option><option value='<'>Less than</option><option value='='>Equal to</option>");
        } else if (value_type === 'xsd:string') {
            operator.append("<option value='Like'>Like</option><option value='='>Equal to</option>");
        }
    });

    $('#attQryRun').on('click', function() {
        map.set('isLoading', 'YES');
        if (featureOverlay) {
            featureOverlay.getSource().clear();
            map.removeLayer(featureOverlay);
        }

        const layer = $('#selectLayer').val();
        const attribute = $('#selectAttribute option:selected').text();
        const operator = $('#selectOperator').val();
        const value = $('#enterValue').val();

        if (!layer) return alert('Select Layer');
        if (!attribute) return alert('Select Attribute');
        if (!operator) return alert('Select Operator');
        if (!value) return alert('Enter Value');

        const value_txt = operator === 'Like' ? `%${value}%` : value;
        const url = `http://localhost:8080/geoserver/GISSimplified/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${layer}&CQL_FILTER=${attribute}+${operator}+'${value_txt}'&outputFormat=application/json`;
        newaddGeoJsonToMap(url);
        newpopulateQueryTable(url);
        setTimeout(() => newaddRowHandlers(url), 300);
        map.set('isLoading', 'NO');
    });
});

function newaddGeoJsonToMap(url) {
    if (geojson) {
        geojson.getSource().clear();
        map.removeLayer(geojson);
    }

    geojson = new ol.layer.Vector({
        source: new ol.source.Vector({
            url: url,
            format: new ol.format.GeoJSON()
        }),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({ color: '#FFFF00', width: 3 }),
            image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: '#FFFF00' }) })
        })
    });

    geojson.getSource().on('addfeature', () => {
        map.getView().fit(geojson.getSource().getExtent(), { duration: 1500, maxZoom: 21 });
    });
    map.addLayer(geojson);
}

function newpopulateQueryTable(url) {
    const tabDiv = document.getElementById('attListDiv');
    let table = document.getElementById('attQryTable');
    if (table) tabDiv.removeChild(table);

    $.getJSON(url, data => {
        const col = ['id'];
        for (let i = 0; i < data.features.length; i++) {
            for (let key in data.features[i].properties) {
                if (!col.includes(key)) col.push(key);
            }
        }

        table = document.createElement('table');
        table.setAttribute('class', 'table table-bordered table-hover table-condensed');
        table.setAttribute('id', 'attQryTable');

        const tr = table.insertRow(-1);
        col.forEach(colName => {
            const th = document.createElement('th');
            th.innerHTML = colName;
            tr.appendChild(th);
        });

        data.features.forEach(feature => {
            const tr = table.insertRow(-1);
            col.forEach((colName, j) => {
                const tabCell = tr.insertCell(-1);
                tabCell.innerHTML = j === 0 ? feature.id : feature.properties[colName] || '';
            });
        });

        tabDiv.appendChild(table);
        tabDiv.style.display = 'block';
    }).fail(err => {
        console.error('Failed to fetch query data:', err);
        alert('Failed to load query results. Please try again.');
    });
}

const highlightStyle = new ol.style.Style({
    fill: new ol.style.Fill({ color: 'rgba(255,0,255,0.3)' }),
    stroke: new ol.style.Stroke({ color: '#FF00FF', width: 3 }),
    image: new ol.style.Circle({ radius: 10, fill: new ol.style.Fill({ color: '#FF00FF' }) })
});

featureOverlay = new ol.layer.Vector({
    source: new ol.source.Vector(),
    map: map,
    style: highlightStyle
});

function newaddRowHandlers() {
    const table = document.getElementById('attQryTable');
    const rows = table.rows;
    const heads = table.getElementsByTagName('th');
    let col_no;
    for (let i = 0; i < heads.length; i++) {
        if (heads[i].innerHTML === 'id') col_no = i;
    }
    for (let i = 1; i < rows.length; i++) {
        rows[i].onclick = function() {
            featureOverlay.getSource().clear();
            $('#attQryTable td').parent('tr').css('background-color', 'white');
            const id = this.cells[col_no].innerHTML;
            $('#attQryTable td:nth-child(' + (col_no + 1) + ')').each(function() {
                if ($(this).text() === id) {
                    $(this).parent('tr').css('background-color', '#d1d8e2');
                }
            });

            const features = geojson.getSource().getFeatures();
            for (let feature of features) {
                if (feature.getId() == id) {
                    featureOverlay.getSource().addFeature(feature);
                    featureOverlay.getSource().on('addfeature', () => {
                        map.getView().fit(featureOverlay.getSource().getExtent(), { duration: 1500, maxZoom: 24 });
                    });
                }
            }
        };
    }
}