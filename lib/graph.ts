'use strict';

/**
 * The graph model every front end draws, whatever network it came from. Each
 * network has its own builder (zigbee-graph.ts, thread-graph.ts, zwave-graph.ts)
 * and they all produce this: Homey at address 0, every device with the route
 * Homey reaches it by, and a quality grade per hop.
 *
 * Networks measure a hop differently — Zigbee and Z-Wave by how many
 * transmissions got through, Thread by link quality and signal strength — so
 * each link carries its own `label` and `summary` for the page to show, and a
 * `score` from 0 to 1 to sort by. The page never has to know how a grade was made.
 */

export type NetworkId = 'zigbee' | 'thread' | 'zwave';

/** Every network, in the order the page offers them. */
export const NETWORKS: NetworkId[] = ['zigbee', 'thread', 'zwave'];

/** How each network is named on the page. */
export const NETWORK_LABELS: Record<NetworkId, string> = {
  zigbee: 'Zigbee',
  thread: 'Thread & Matter',
  zwave: 'Z-Wave',
};

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === 'string' && (NETWORKS as string[]).includes(value);
}

export type Grade = 'good' | 'fair' | 'weak' | 'bad' | 'unknown';

/** A labelled value for a details panel, e.g. { label: 'Vendor', value: 'Aqara' }. */
export type Fact = { label: string; value: string };

/**
 * Grades by TX success rate, for the networks that count transmissions. The
 * counters carry no LQI/RSSI, so this is a proxy: a device that has to retry a
 * lot to get its frames through is a device with a poor link to its parent.
 */
const RATE_GRADES = [
  { grade: 'good', min: 0.95 },
  { grade: 'fair', min: 0.85 },
  { grade: 'weak', min: 0.70 },
  { grade: 'bad', min: 0 },
] as const;

/** Below this many transmissions the success rate is too noisy to judge. */
export const MIN_SAMPLE = 30;

export function gradeFor(rate: number | null, sample: number): Grade {
  if (rate == null || sample < MIN_SAMPLE) return 'unknown';
  return (RATE_GRADES.find((g) => rate >= g.min) ?? RATE_GRADES[RATE_GRADES.length - 1]).grade;
}

export type GraphNode = {
  /** The node's id in the graph. Homey is always 0; the rest depends on the network. */
  addr: number;
  /** The address the device reports on its own network. */
  nwkAddr: number;
  /** That address as the network writes it, e.g. "0x9c00" or "node 5". */
  addrLabel: string;
  /** The devices that report the same network address, if any. */
  sharedWith?: string[];
  /** The network address the device had when Homey interviewed it, if it says. */
  pairedAddr?: number;
  /** On a stale route entry: the graph ids of the devices that most likely left it behind. */
  probablyWas?: number[];
  /** On a device: the stale route entry it most likely left behind, by its address. */
  staleAddr?: number;
  /** A stable id that survives an address change: the IEEE address on Zigbee. */
  ieeeAddr: string | null;
  name: string;
  /** 'router', 'enddevice', 'ghost', …; routers are drawn as squares. */
  type: string;
  modelId?: string;
  manufacturerName?: string;
  swBuildId?: string;
  ownerUri?: string;
  receiveWhenIdle?: boolean;
  lastSeen?: number;
  stats: {
    tx: number;
    txSuccess: number;
    txError: number;
    rx: number;
    successRate: number | null;
  };
  capabilities: Record<string, boolean> | null;
  endpoints: Array<{
    endpointId?: number;
    profileId?: number;
    deviceId?: number;
    inputClusters: number[];
    outputClusters: number[];
  }>;
  bindings: Record<string, Array<string | number>> | null;
  /** Network-specific details for the details panel, in the order to show them. */
  facts?: Fact[];
  /** Something the page should say about this device, e.g. why it has no route. */
  note?: string;
  isGhost: boolean;
  isCoordinator: boolean;
  hasRoute: boolean;
  hops: number | null;
  path: number[] | null;
  parent?: number;
  childCount: number;
  descendantCount: number;
  uplinkGrade: Grade;
  /** The score of the hop to its parent, 0–1: the TX success rate where there is one. */
  uplinkRate: number | null;
};

export type GraphLink = {
  id: string;
  source: number;
  target: number;
  kind: 'route' | 'binding';
  clusters?: Array<string | number>;
  /** TX success rate, 0–1, on the networks that count transmissions. */
  rate?: number | null;
  /** How many transmissions `rate` is from; also sets the line's width. */
  sample?: number;
  txError?: number;
  grade?: Grade;
  /** 0–1, higher is better: what the weak-links list sorts by. */
  score?: number | null;
  /** The hop's quality in a few characters, e.g. "97%" or "−71 dBm". */
  label?: string;
  /** The hop's quality in a sentence. */
  summary?: string;
  /** What the hop runs over, where a network has more than one kind: 'thread', 'wifi', 'ethernet'. */
  medium?: string;
};

export type Graph = {
  network: NetworkId;
  controller: {
    channel?: number;
    panId?: string;
    extendedPanId?: string;
    ieeeAddress?: string;
    softwareVersion?: string;
    currentCommand?: string;
    /** Network-specific details about Homey's own radio, in the order to show them. */
    facts?: Fact[];
  };
  meta: {
    ready?: boolean;
    error?: string | null;
    /** Something the page should say about the whole map, e.g. what the network doesn't tell us. */
    notice?: string;
    nodeCount: number;
    deviceCount: number;
    routerCount: number;
    endDeviceCount: number;
    ghostCount: number;
    unreachableCount: number;
    bindingCount: number;
    maxHops: number;
    weakLinkCount: number;
    generatedAt: number;
  };
  nodes: GraphNode[];
  links: GraphLink[];
};

/** A device with nothing filled in yet; each builder sets what its network knows. */
export function blankNode(addr: number, name: string, type: string): GraphNode {
  return {
    addr,
    nwkAddr: addr,
    addrLabel: String(addr),
    ieeeAddr: null,
    name,
    type,
    stats: {
      tx: 0, txSuccess: 0, txError: 0, rx: 0, successRate: null,
    },
    capabilities: null,
    endpoints: [],
    bindings: null,
    isGhost: false,
    isCoordinator: false,
    hasRoute: false,
    hops: null,
    path: null,
    childCount: 0,
    descendantCount: 0,
    uplinkGrade: 'unknown',
    uplinkRate: null,
  };
}

/** The label and sentence for a hop graded by TX success rate. */
export function describeRate(rate: number | null | undefined, sample: number, grade: Grade): { label: string; summary: string } {
  if (grade === 'unknown' || rate == null) {
    return { label: '—', summary: `Link quality unknown · only ${sample.toLocaleString('en')} transmissions` };
  }
  const pct = Math.round(rate * 100);
  const word = grade.charAt(0).toUpperCase() + grade.slice(1);
  return { label: `${pct}%`, summary: `${word} link · ${pct}% of ${sample.toLocaleString('en')} transmissions got through` };
}

/**
 * Fills in what follows from the nodes' paths: each node's parent, the route
 * links, and the counts in `meta`. The builder has already set `path` and
 * `hops` on each node, and hands in how each hop is graded.
 */
export function finishGraph(
  network: NetworkId,
  byAddr: Map<number, GraphNode>,
  gradeLink: (link: GraphLink, child: GraphNode) => void,
  extra: { controller: Graph['controller']; meta: Partial<Graph['meta']>; links?: GraphLink[] },
): Graph {
  const links = new Map<string, GraphLink>();
  const addLink = (source: number, target: number) => {
    const id = `${source}->${target}:route`;
    if (!links.has(id)) {
      links.set(id, {
        id, source, target, kind: 'route',
      });
    }
  };

  byAddr.forEach((node) => {
    if (!node.path || node.path.length < 2) return;
    for (let i = 0; i < node.path.length - 1; i += 1) addLink(node.path[i], node.path[i + 1]);
    node.parent = node.path[node.path.length - 2];
  });

  // Every route link a->b is b's uplink: b.parent === a, since each node's path
  // is its parent's path plus itself.
  links.forEach((link) => {
    const child = byAddr.get(link.target);
    if (!child) return;
    gradeLink(link, child);
    child.uplinkGrade = link.grade ?? 'unknown';
    child.uplinkRate = link.score ?? null;
  });

  const childCount = new Map<number, number>();
  byAddr.forEach((node) => {
    if (node.parent === undefined) return;
    childCount.set(node.parent, (childCount.get(node.parent) ?? 0) + 1);
  });
  byAddr.forEach((node) => {
    node.childCount = childCount.get(node.addr) ?? 0;
  });
  byAddr.forEach((node) => {
    (node.path ?? []).slice(0, -1).forEach((hop) => {
      const relay = byAddr.get(hop);
      if (relay) relay.descendantCount += 1;
    });
  });

  const nodes = [...byAddr.values()].sort((a, b) => (a.hops ?? 99) - (b.hops ?? 99));
  const linkList = [...links.values(), ...(extra.links ?? [])];

  return {
    network,
    controller: extra.controller,
    meta: {
      nodeCount: nodes.length,
      deviceCount: nodes.filter((n) => !n.isGhost).length,
      routerCount: nodes.filter((n) => n.type === 'router').length,
      endDeviceCount: nodes.filter((n) => n.type === 'enddevice').length,
      ghostCount: nodes.filter((n) => n.isGhost).length,
      unreachableCount: nodes.filter((n) => !n.hasRoute && !n.isCoordinator).length,
      bindingCount: linkList.filter((l) => l.kind === 'binding').length,
      maxHops: nodes.reduce((max, n) => Math.max(max, n.hops ?? 0), 0),
      weakLinkCount: linkList.filter((l) => l.grade === 'weak' || l.grade === 'bad').length,
      generatedAt: Date.now(),
      ...extra.meta,
    },
    nodes,
    links: linkList,
  };
}
