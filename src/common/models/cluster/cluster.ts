import { Class, Instance, isInstanceOf } from 'immutable-class';
import { External, ExternalValue, AttributeInfo } from 'plywood';
import { RefreshRule } from '../refresh-rule/refresh-rule';

export type SupportedTypes = 'druid' | 'mysql' | 'postgres';
export type SourceListScan = 'disable' | 'auto';

export interface ClusterValue {
  name: string;
  type?: SupportedTypes;
  host?: string;
  version?: string;
  timeout?: number;
  sourceListScan?: SourceListScan;
  sourceListRefreshOnLoad?: boolean;
  sourceListRefreshInterval?: number;
  sourceReintrospectOnLoad?: boolean;
  sourceReintrospectInterval?: number;
  introspectionStrategy?: string;
  database?: string;
  user?: string;
  password?: string;
}

export interface ClusterJS {
  name: string;
  type?: SupportedTypes;
  host?: string;
  version?: string;
  timeout?: number;
  sourceListScan?: SourceListScan;
  sourceListRefreshOnLoad?: boolean;
  sourceListRefreshInterval?: number;
  sourceReintrospectOnLoad?: boolean;
  sourceReintrospectInterval?: number;
  introspectionStrategy?: string;
  database?: string;
  user?: string;
  password?: string;
}

function parseIntFromPossibleString(x: any) {
  return typeof x === 'string' ? parseInt(x, 10) : x;
}

var check: Class<ClusterValue, ClusterJS>;
export class Cluster implements Instance<ClusterValue, ClusterJS> {
  static DEFAULT_TIMEOUT = 40000;
  static DEFAULT_SOURCE_LIST_REFRESH_INTERVAL = 15000;
  static DEFAULT_INTROSPECTION_STRATEGY = 'segment-metadata-fallback';

  static isCluster(candidate: any): candidate is Cluster {
    return isInstanceOf(candidate, Cluster);
  }

  static fromJS(parameters: ClusterJS): Cluster {
    var {
      name,
      type,
      host,
      version,
      timeout,
      sourceListScan,
      sourceListRefreshOnLoad,
      sourceListRefreshInterval,
      sourceReintrospectOnLoad,
      sourceReintrospectInterval,
      introspectionStrategy,
      database,
      user,
      password
    } = parameters;

    name = name || (parameters as any).clusterName || 'druid';

    // host might be written as druidHost or brokerHost
    host = host || (parameters as any).druidHost || (parameters as any).brokerHost;

    var value: ClusterValue = {
      name,
      type,
      host,
      version,
      timeout: parseIntFromPossibleString(timeout),
      sourceListScan: sourceListScan,
      sourceListRefreshOnLoad: sourceListRefreshOnLoad,
      sourceListRefreshInterval: parseIntFromPossibleString(sourceListRefreshInterval),
      sourceReintrospectOnLoad: sourceReintrospectOnLoad,
      sourceReintrospectInterval: parseIntFromPossibleString(sourceReintrospectInterval),
      introspectionStrategy: introspectionStrategy,
      database,
      user,
      password
    };
    return new Cluster(value);
  }


  public name: string;
  public type: SupportedTypes;
  public host: string;
  public version: string;
  public timeout: number;
  public sourceListScan: SourceListScan;
  public sourceListRefreshOnLoad: boolean;
  public sourceListRefreshInterval: number;
  public sourceReintrospectOnLoad: boolean;
  public sourceReintrospectInterval: number;

  // Druid
  public introspectionStrategy: string;

  // SQLs
  public database: string;
  public user: string;
  public password: string;

  constructor(parameters: ClusterValue) {
    var name = parameters.name;
    if (typeof name !== 'string') throw new Error('must have name');
    if (name === 'native') throw new Error("cluster can not be called 'native'");
    this.name = name;

    this.type = parameters.type;
    this.host = parameters.host;

    this.version = parameters.version;

    this.timeout = parameters.timeout || Cluster.DEFAULT_TIMEOUT;
    this.sourceListScan = parameters.sourceListScan;

    this.sourceListRefreshOnLoad = parameters.sourceListRefreshOnLoad || false;
    this.sourceListRefreshInterval = parameters.sourceListRefreshInterval || Cluster.DEFAULT_SOURCE_LIST_REFRESH_INTERVAL;
    if (this.sourceListRefreshInterval && this.sourceListRefreshInterval < 1000) {
      throw new Error(`can not set sourceListRefreshInterval to < 1000 (is ${this.sourceListRefreshInterval})`);
    }

    this.sourceReintrospectOnLoad = parameters.sourceReintrospectOnLoad;
    this.sourceReintrospectInterval = parameters.sourceReintrospectInterval;
    if (this.sourceReintrospectInterval && this.sourceReintrospectInterval < 1000) {
      throw new Error(`can not set sourceReintrospectInterval to < 1000 (is ${this.sourceReintrospectInterval})`);
    }

    switch (this.type) {
      case 'druid':
        this.introspectionStrategy = parameters.introspectionStrategy || Cluster.DEFAULT_INTROSPECTION_STRATEGY;
        break;

      case 'mysql':
      case 'postgres':
        if (!parameters.database) throw new Error(`cluster '${name}' must specify a database`);
        this.database = parameters.database;
        this.user = parameters.user;
        this.password = parameters.password;
        break;
    }

  }

  public valueOf(): ClusterValue {
    return {
      name: this.name,
      type: this.type,
      host: this.host,
      version: this.version,
      timeout: this.timeout,
      sourceListScan: this.sourceListScan,
      sourceListRefreshOnLoad: this.sourceListRefreshOnLoad,
      sourceListRefreshInterval: this.sourceListRefreshInterval,
      sourceReintrospectOnLoad: this.sourceReintrospectOnLoad,
      sourceReintrospectInterval: this.sourceReintrospectInterval,
      introspectionStrategy: this.introspectionStrategy,
      database: this.database,
      user: this.user,
      password: this.password
    };
  }

  public toJS(): ClusterJS {
    var js: ClusterJS = {
      name: this.name
    };
    if (this.type) js.type = this.type;
    if (this.host) js.host = this.host;
    if (this.version) js.version = this.version;
    js.timeout = this.timeout;
    js.sourceListScan = this.sourceListScan;
    js.sourceListRefreshOnLoad = this.sourceListRefreshOnLoad;
    js.sourceListRefreshInterval = this.sourceListRefreshInterval;
    js.sourceReintrospectOnLoad = this.sourceReintrospectOnLoad;
    js.sourceReintrospectInterval = this.sourceReintrospectInterval;

    if (this.introspectionStrategy) js.introspectionStrategy = this.introspectionStrategy;

    if (this.database) js.database = this.database;
    if (this.user) js.user = this.user;
    if (this.password) js.password = this.password;
    return js;
  }

  public toJSON(): ClusterJS {
    return this.toJS();
  }

  public toString(): string {
    return `[Cluster ${this.name}]`;
  }

  public equals(other: Cluster): boolean {
    return Cluster.isCluster(other) &&
      this.name === other.name &&
      this.type === other.type &&
      this.host === other.host &&
      this.version === other.version &&
      this.sourceListScan === other.sourceListScan &&
      this.sourceListRefreshOnLoad === other.sourceListRefreshOnLoad &&
      this.sourceListRefreshInterval === other.sourceListRefreshInterval &&
      this.sourceReintrospectOnLoad === other.sourceReintrospectOnLoad &&
      this.sourceReintrospectInterval === other.sourceReintrospectInterval &&
      this.introspectionStrategy === other.introspectionStrategy &&
      this.database === other.database &&
      this.user === other.user &&
      this.password === other.password;
  }

  public toClientCluster(): Cluster {
    return new Cluster({
      name: this.name
    });
  }

  public makeExternalFromSourceName(source: string, version?: string): External {
    return External.fromValue({
      engine: this.type,
      source,
      version: version,

      allowSelectQueries: true,
      allowEternity: false
    });
  }

}
check = Cluster;