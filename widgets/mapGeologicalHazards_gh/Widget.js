define(['dojo/_base/declare', 'jimu/BaseWidget', 'dijit/_WidgetsInTemplateMixin', "esri/toolbars/draw", "esri/graphic", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", 'dojo/_base/Color', "esri/layers/GraphicsLayer", "dojo/sniff", "esri/request", "esri/geometry/scaleUtils", "jimu/portalUtils", "dojo/_base/array", "esri/InfoTemplate", "esri/layers/FeatureLayer", "dojo/dom", "esri/renderers/SimpleRenderer", "esri/tasks/DataFile", "esri/tasks/Geoprocessor"], function (declare, BaseWidget, _WidgetsInTemplateMixin, Draw, Graphic, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color, GraphicsLayer, sniff, esriRequest, scaleUtils, portalUtils, arrayUtils, InfoTemplate, FeatureLayer, dom, SimpleRenderer, DataFile, Geoprocessor) {

  var idGraphicFilterGh = "graphicFilterGh";
  var idFeatureLayerGh = "featureLayerGh";

  var symbolPolygonGh = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 2), new Color([255, 255, 255, 0.1]));

  // To create a widget, you need to derive from BaseWidget.
  return declare([BaseWidget, _WidgetsInTemplateMixin], {

    // Custom widget code goes here

    baseClass: 'map-geological-hazards-gh',
    portalUrl: null,
    uploadServiceUrl: portalUrl + '/sharing/rest/content/features/generate',
    itemIDLoad: null,
    map_type_selected: null,
    stakeHolder: null,
    json_graphic: null,
    zip_graphic: null,
    jobId: null,

    postCreate: function postCreate() {
      this.inherited(arguments);
      console.log('mapGeologicalHazards_gh::postCreate');
      self_gh = this;
      portalUrl = portalUtils.getPortal(self_gh.appConfig.portalUrl).portalUrl;
    },
    _createToolbar: function _createToolbar() {
      toolbarGh = new Draw(self_gh.map);
      toolbarGh.on("draw-end", self_gh._addToMap);
    },
    _addToMap: function _addToMap(evt) {
      toolbarGh.deactivate();
      var area = void 0;
      area = evt.geometry;

      var graphic = new Graphic(area, symbolPolygonGh);
      var graphicLayer = new GraphicsLayer({
        id: idGraphicFilterGh
      });
      graphicLayer.add(graphic);
      self_gh.map.addLayer(graphicLayer);
      self_gh.map.setExtent(graphic._extent, true);
      self_gh.map.setInfoWindowOnClick(true);
      self_gh.json_graphic = graphic.geometry;
    },
    _activateTool: function _activateTool() {
      self_gh.map.setInfoWindowOnClick(false);
      self_gh._removeAllGrapics();
      tool = this.value.toUpperCase();
      toolbarGh.activate(Draw[tool]);
    },
    _removeAllGrapics: function _removeAllGrapics() {
      if (self_gh.map.graphicsLayerIds.includes(idGraphicFilterGh)) {
        self_gh.map.removeLayer(self_gh.map.getLayer(idGraphicFilterGh));
      }
      if (self_gh.map.graphicsLayerIds.includes(idFeatureLayerGh)) {
        self_gh.map.removeLayer(self_gh.map.getLayer(idFeatureLayerGh));
      }
      dom.byId("inputUploadZipGhId").value = "";
      self_gh.json_graphic = null;
      self_gh.zip_graphic = null;
    },
    _progressBarStatus: function _progressBarStatus(show) {
      if (show) {
        self_gh.containerProgressBarGhAp.classList.toggle('active');
      } else {
        self_gh.containerProgressBarGhAp.classList.remove('active');
      };
    },
    _errorContainerStatus: function _errorContainerStatus(show) {
      if (show) {
        self_gh.containerErrorGhAp.classList.toggle('active');
      } else {
        self_gh.containerErrorGhAp.classList.remove('active');
      }
    },
    _dissabledButon: function _dissabledButon(disabled) {
      dojo.byId("btnRunProcessGhId").disabled = disabled;
      dojo.byId("btnCancelProcessGhId").disabled = !disabled;
    },
    _showTextError: function _showTextError(err) {
      self_gh._progressBarStatus(false);
      self_gh.containerErrorGhAp.innerHTML = '<p style="color:#F94C66">' + err + '</p>';
      self_gh._errorContainerStatus(true);
      self_gh._dissabledButon(false);
    },
    _uploadShapefile: function _uploadShapefile(evt) {
      // self_gh.busyIndicator.show();
      self_gh._progressBarStatus(true);
      self_gh._errorContainerStatus(false);
      // Obtenemos la ruta del archivo shapefile ingresado
      var fileName = evt.target.value.toLowerCase();

      // si el navegador es internet explorer
      if (sniff("ie")) {
        // Se extrae solo el nombre
        var arr = fileName.split("\\");
        fileName = arr[arr.length - 1];
      }
      if (fileName.endsWith('.zip')) {
        // Verificamos que el archivo ingresado tenga la extension .zip
        // Obtenemos los datos del archivo zip
        self_gh._getDataFromShapefileZip(fileName);
      } else {
        // Si no es un zip se retorna un mensaje
        var err = { message: "Debe cargar el archivo shapefile como *.zip"
          // self_gh._errorStateLoad(err);
        };self_gh._showTextError(err.message);
        // dom.byId('stateLoadId_pa').innerHTML = '<p style="color:red">Debe cargar el archivo shapefile como *.zip</p>';
      }
    },
    _getDataFromShapefileZip: function _getDataFromShapefileZip(fileName) {
      // Dividimos el nombre y la extension
      var name = fileName.split(".");

      // reemplazamos el prefijo por una cadena vacia
      name = name[0].replace("c:\\fakepath\\", "");

      // actualizamos el estado a "cargando"
      var messageLoaded = '<p style="color:#FFA500">Cargando ' + name + ' ...</p>';
      self_gh.containerMessagesProgressGhAp.innerHTML = messageLoaded;
      // dom.byId('stateLoadId_pa').innerHTML = messageLoaded

      // creamos el objeto params
      var params = {
        'name': name,
        'targetSR': self_gh.map.spatialReference,
        'maxRecordCount': 1000,
        'enforceInputFileSizeLimit': true,
        'enforceOutputJsonSizeLimit': true
      };

      var extent = scaleUtils.getExtentForScale(self_gh.map, 40000);
      var resolution = extent.getWidth() / self_gh.map.width;
      params.generalize = true;
      params.maxAllowableOffset = resolution;
      params.reducePrecision = true;
      params.numberOfDigitsAfterDecimal = 0;

      // Definimos el contenido para ejecutar el servicio de carga
      var content = {
        'filetype': 'shapefile',
        'publishParameters': JSON.stringify(params),
        'f': 'json'
      };
      // Realizamos la peticion al servicio con los parametros
      esriRequest({
        url: self_gh.uploadServiceUrl,
        content: content,
        form: dom.byId('uploadFormGhId'),
        handleAs: 'json',
        callbackParamName: "callback",
        load: function load(response) {
          if (response.error) {
            // Si retorna un error se deriva a la funcion _errorStateLoad
            self_gh._showTextError(response.error);
            return;
          }
          self_gh._addShapefileToMap(response.featureCollection);
        },
        error: self_gh._showTextError
      });

      // Enviamos el archivo a AGS
      esriRequest({
        url: self_gh.config.uploadServiceUrl,
        form: dom.byId('uploadFormGhId'),
        content: { f: 'json' },
        handleAs: 'json'
      }).then(self_gh._setLoadItemID, self_gh._uploadFailed);
    },
    _setLoadItemID: function _setLoadItemID(responseUpload) {
      self_gh.itemIDLoad = responseUpload["item"].itemID;
    },
    _uploadFailed: function _uploadFailed(response) {
      self_gh._showTextError(response);
      self_gh._dissabledButon(false);
      // console.log("Failed: ", response);
    },
    _addShapefileToMap: function _addShapefileToMap(featureCollection) {
      var fullExtent = void 0;
      var layers = [];

      if (featureCollection.layers.length > 0) {
        if (featureCollection.layers[0].featureSet.geometryType != 'esriGeometryPolygon') {
          var err = { message: "El archivo shapefile cargado no es de tipo polígono" };
          self_gh._showTextError(err);
          return;
        }
      }

      // iteramos el feature ingresado por registro
      arrayUtils.forEach(featureCollection.layers, function (layer) {
        // Configuramos el popup para el registro actual
        var infoTemplate = new InfoTemplate("Detalle", "${*}");

        // Definimos el featurelayer para el registro actual y asociamos el popup
        var featureLayer = new FeatureLayer(layer, { id: idFeatureLayerGh, infoTemplate: infoTemplate });

        // Agregamos el evento para abrir el popup
        featureLayer.on('click', function (event) {
          self_gh.map.infoWindow.setFeatures([event.graphic]);
        });
        featureLayer.setRenderer(new SimpleRenderer(symbolPolygonGh));

        // Agregamos el extent de cada uno de los registros
        fullExtent = fullExtent ? fullExtent.union(featureLayer.fullExtent) : featureLayer.fullExtent;

        // Agregamos el registro al array de layers
        layers.push(featureLayer);
      });

      // Eliminamos el layer anterior
      self_gh._removeAllGrapics();

      self_gh.zip_graphic = self_gh.itemIDLoad;

      // Cargamos Layers al mapa (esto lo cargara como una unica entidad)
      self_gh.map.addLayers(layers);

      // Configuramos la extension de visualizacion con la variable fullExtent
      self_gh.map.setExtent(fullExtent.expand(1.25), true);
      self_gh._progressBarStatus(false);
    },
    _checkRadioButton: function _checkRadioButton(evt) {
      self_gh.itTitleMapGhAp.value = evt.target.parentElement.querySelector('label[for=\'' + evt.target.id + '\']').innerHTML;
      self_gh.map_type_selected = evt.target.value;
    },
    _selectedStakeholder: function _selectedStakeholder(evt) {
      self_gh.stakeHolder = evt.target.selectedOptions[0].innerHTML;
    },
    _executeGPService: function _executeGPService() {
      self_gh._dissabledButon(true);
      self_gh._errorContainerStatus(false);
      self_gh._progressBarStatus(true);

      var dataFile = new DataFile();
      dataFile.itemID = self_gh.zip_graphic;
      var params = {
        "shapefile": dataFile,
        "json": JSON.stringify(self_gh.json_graphic),
        "maptype": self_gh.map_type_selected,
        "maptitle": self_gh.itTitleMapGhAp.value,
        "mapautor": self_gh.stakeHolder,
        "mapnumber": dom.byId("itNumberMapGhId").value,
        "scale": ''

      };
      self_gh.gp = new Geoprocessor(self_gh.config.mapaPeligrosGeologicosGPService);
      self_gh.gp.submitJob(params, self_gh._completeCallback, self_gh._statusCallback);
    },
    _statusCallback: function _statusCallback(JobInfo) {
      console.log(JobInfo);
      self_gh.jobId = JobInfo.jobId;
      var textMessage = JobInfo.messages.map(function (message) {
        return message.description;
      }).join('<br>');
      self_gh.containerMessagesProgressGhAp.innerHTML = textMessage;
    },
    _completeCallback: function _completeCallback(JobInfo) {
      self_gh._dissabledButon(false);
      self_gh._progressBarStatus(false);
      self_gh.containerMessagesProgressGhAp.innerHTML = '';
      if (JobInfo.jobStatus == "esriJobFailed") {
        self_gh._showTextError("El servicio no se encuentra disponible; por favor intente nuevamente en otro momento");
        return;
      }
      // } else if (JobInfo.jobStatus == "esriJobCancelling" || jobStatus == "esriJobCancelled"){
      //   self_gh._dissabledButon(false)
      //   self_gh._progressBarStatus(false);
      //   // self_gh.containerMessagesProgressGhAp.innerHTML = "Proceso cancelado";
      // } 
      else {
          self_gh.gp.getResultData(JobInfo.jobId, "response", function (result) {
            if (!result['value']['status']) {
              self_gh._showTextError('Ocurrio un problema al procesar la informaci\xF3n\n' + result['value']['message']);
              return;
            }
            var a = document.createElement('a');
            a.href = result['value']['response']['zip_url'];
            a.download = 'download';
            a.click();
          });
        }
    },
    _cancelProcess: function _cancelProcess(evt) {
      self_gh.gp.cancelJob(self_gh.jobId, function (info) {
        // self_gh.containerMessagesProgressGhAp.innerHTML = info.jobStatus;
        // self_gh._dissabledButon(false)
        // self_gh._progressBarStatus(false);
      });
    },
    onOpen: function onOpen() {
      console.log('mapGeologicalHazards_gh::onOpen');
      this._createToolbar();
      dojo.query(".btnPolygonGraphGhCls").on('click', this._activateTool);
      dojo.query(".btnRemoveGraphGhCls").on('click', this._removeAllGrapics);
      dojo.query('.inputUploadZipGhCls').on('change', this._uploadShapefile);
      dojo.query('.rbtnGhCls').on('click', this._checkRadioButton);
      dojo.query('.selectStakeholderGhCls').on('change', this._selectedStakeholder);
      dojo.query('.btnRunProcessGhCls').on('click', this._executeGPService);
      dojo.query('.btnCancelProcessGhCls').on('click', this._cancelProcess);
      dom.byId("rbtnSmmGhId").click();
      self_gh.stakeHolder = self_gh.selectStakeholderGhAp.selectedOptions[0].innerHTML;
      dojo.byId("btnCancelProcessGhId").disabled = true;

      var panel = this.getPanel();
      // panel.position.width = 600; 
      panel.position.height = 700;
      panel.setPosition(panel.position);
      panel.panelManager.normalizePanel(panel);
      // dom.byId("rbtnSmmGhId").checked = true;
    }
  }
  // onClose(){
  //   console.log('mapGeologicalHazards_gh::onClose');
  // },
  // onMinimize(){
  //   console.log('mapGeologicalHazards_gh::onMinimize');
  // },
  // onMaximize(){
  //   console.log('mapGeologicalHazards_gh::onMaximize');
  // },
  // onSignIn(credential){
  //   console.log('mapGeologicalHazards_gh::onSignIn', credential);
  // },
  // onSignOut(){
  //   console.log('mapGeologicalHazards_gh::onSignOut');
  // }
  // onPositionChange(){
  //   console.log('mapGeologicalHazards_gh::onPositionChange');
  // },
  // resize(){
  //   console.log('mapGeologicalHazards_gh::resize');
  // }
  );
});
//# sourceMappingURL=Widget.js.map
