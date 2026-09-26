'use strict';

import type Homey from 'homey';

/** The app instance, as far as this API surface needs it. */
type NetworkVisualizerApp = {
  getZigbeeState(): Promise<unknown>;
  getZigbeeGraph(): Promise<unknown>;
  getVisualizerUrl(): Promise<string>;
};

type ApiRequest = {
  homey: Homey.App['homey'];
  query: Record<string, string>;
  params: Record<string, string>;
};

const app = ({ homey }: ApiRequest) => homey.app as unknown as NetworkVisualizerApp;

module.exports = {

  /**
   * GET /api/app/no.arvebjoe.network-visualizer/state
   * The raw Zigbee network state, for inspection and export.
   */
  async getZigbeeState(request: ApiRequest) {
    return app(request).getZigbeeState();
  },

  /**
   * GET /api/app/no.arvebjoe.network-visualizer/network
   * The parsed graph model the settings page renders.
   */
  async getZigbeeGraph(request: ApiRequest) {
    return app(request).getZigbeeGraph();
  },

  /**
   * GET /api/app/no.arvebjoe.network-visualizer/visualizer
   * Where the full visualizer opens on the local network.
   */
  async getVisualizerUrl(request: ApiRequest) {
    return app(request).getVisualizerUrl();
  },

};
