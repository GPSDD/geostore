'use strict';

var Router = require('koa-router');
var logger = require('logger');
var GeoStoreValidator = require('validators/geoStoreValidator');
var GeoJSONSerializer = require('serializers/geoJSONSerializer');
var CountryListSerializer = require('serializers/countryListSerializer');
var GeoStore = require('models/geoStore');
var IdConnection = require('models/idConnection');
var CartoService = require('services/cartoDBService');
var GeoStoreService = require('services/geoStoreService');
var GeoJsonIOService = require('services/geojsonioService');
var ProviderNotFound = require('errors/providerNotFound');
var GeoJSONNotFound = require('errors/geoJSONNotFound');
var geojsonToArcGIS = require('arcgis-to-geojson-utils').geojsonToArcGIS;
var arcgisToGeoJSON = require('arcgis-to-geojson-utils').arcgisToGeoJSON;

var router = new Router({
    prefix: '/geostore'
});

class GeoStoreRouter {

    static * getGeoStoreById() {
        this.assert(this.params.hash, 400, 'Hash param not found');
        logger.debug('Getting geostore by hash %s', this.params.hash);
        var geoStore = null;

        try {
            geoStore = yield GeoStoreService.getGeostoreById(this.params.hash);
            if(!geoStore) {
                this.throw(404, 'GeoStore not found');
                return;
            }
            logger.debug('GeoStore found. Returning...');
            if(!geoStore.bbox) {
                geoStore = yield GeoStoreService.calculateBBox(geoStore);
            }
            if (this.query.format && this.query.format === 'esri') {
              logger.debug('esri', geojsonToArcGIS(geoStore.geojson)[0]);
              geoStore.esrijson = geojsonToArcGIS(geoStore.geojson)[0].geometry;
            }

            this.body = GeoJSONSerializer.serialize(geoStore);

        } catch(e) {
            logger.error(e);
            throw e;
        }
    }

    static * createGeoStore() {
        logger.info('Saving GeoStore');
        try{
          const data = {
            provider: this.request.body.provider,
            info: {},
            lock: this.request.body.lock ? this.request.body.lock : false
          };
          if (!this.request.body.geojson && !this.request.body.esrijson && !this.request.body.provider){
            this.throw(400, 'geojson, esrijson or provider required');
            return;
          }
          if (this.request.body.esrijson){
            this.request.body.geojson = arcgisToGeoJSON(this.request.body.esrijson);
          }

          let geostore = yield GeoStoreService.saveGeostore(this.request.body.geojson, data);
          logger.debug(JSON.stringify(geostore.geojson));
          this.body = GeoJSONSerializer.serialize(geostore);
        } catch(err){
            if (err instanceof ProviderNotFound || err instanceof GeoJSONNotFound){
                this.throw(400, err.message);
                return ;
            }
            throw err;
        }
    }

    static * getNational() {
        logger.info('Obtaining national data geojson');
        const data = yield CartoService.getNational(this.params.iso);
        if (!data) {
          this.throw(404, 'Country not found');
        }
        this.body = GeoJSONSerializer.serialize(data);
    }

    static * getNationalList() {
        logger.info('Obtaining national list');
        const data = yield CartoService.getNationalList();
        if (!data) {
          this.throw(404, 'Empty List');
        }
        this.body = CountryListSerializer.serialize(data);
    }

    static * getSubnational() {
        logger.info('Obtaining subnational data geojson');
        const data = yield CartoService.getSubnational(this.params.iso, this.params.id1);
        if (!data) {
          this.throw(404, 'Country/Region not found');
        }
        this.body = GeoJSONSerializer.serialize(data);
    }

    static * getAdmin2() {
        logger.info('Obtaining Admin2 data geojson');
        const data = yield CartoService.getAdmin2(this.params.iso, this.params.id1, this.params.id2);
        if (!data) {
          this.throw(404, 'Country/Admin1/Admin2 not found');
        }
        this.body = GeoJSONSerializer.serialize(data);
    }

    static * use() {
        logger.info('Obtaining use data with name %s and id %s', this.params.name, this.params.id);
        let useTable = null;
        switch (this.params.name) {
            case 'mining':
                useTable = 'gfw_mining';
                break;
            case 'oilpalm':
                useTable = 'gfw_oil_palm';
                break;
            case 'fiber':
                useTable = 'gfw_wood_fiber';
                break;
            case 'logging':
                useTable = 'gfw_logging';
                break;
            default:
                this.throw(400, 'Name param invalid');
        }
        if (!useTable) {
            this.throw(404, 'Name not found');
        }
        const data = yield CartoService.getUse(useTable, this.params.id);
        if (!data) {
          this.throw(404, 'Use not found');
        }
        this.body = GeoJSONSerializer.serialize(data);
    }

    static * wdpa() {
        logger.info('Obtaining wpda data with id %s', this.params.id);

        const data = yield CartoService.getWdpa(this.params.id);
        if (!data) {
          this.throw(404, 'Wdpa not found');
        }
        this.body = GeoJSONSerializer.serialize(data);
    }

    static * view() {
        this.assert(this.params.hash, 400, 'Hash param not found');
        logger.debug('Getting geostore by hash %s', this.params.hash);
        var geoStore = null;
        var geojsonIoPath = null;

        try {
            geoStore = yield GeoStoreService.getGeostoreById(this.params.hash);

            if(!geoStore) {
                this.throw(404, 'GeoStore not found');
                return;
            }
            logger.debug('GeoStore found. Returning...');

            geojsonIoPath = yield GeoJsonIOService.view(geoStore.geojson);
            this.body = {'view_link': geojsonIoPath};

        } catch(e) {
            logger.error(e);
            throw e;
        }
    }
}

router.get('/:hash', GeoStoreRouter.getGeoStoreById);
router.post('/', GeoStoreValidator.create, GeoStoreRouter.createGeoStore);
router.get('/admin/:iso', GeoStoreRouter.getNational);
router.get('/admin/list', GeoStoreRouter.getNationalList);
router.get('/admin/:iso/:id1', GeoStoreRouter.getSubnational);
router.get('/admin/:iso/:id1/:id2', GeoStoreRouter.getAdmin2);
router.get('/use/:name/:id', GeoStoreRouter.use);
router.get('/wdpa/:id', GeoStoreRouter.wdpa);
router.get('/:hash/view', GeoStoreRouter.view);

module.exports = router;
