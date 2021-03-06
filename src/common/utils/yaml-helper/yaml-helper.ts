/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { $, AttributeInfo, RefExpression } from 'plywood';
import { DataCube, Dimension, Measure, Cluster } from '../../../common/models/index';
import { DATA_CUBE, DIMENSION, MEASURE, CLUSTER } from '../../../common/models/labels';

function spaces(n: number) {
  return (new Array(n + 1)).join(' ');
}

function yamlObject(lines: string[], indent = 2): string[] {
  var pad = spaces(indent);
  return lines.map((line, i) => {
    if (line === '') return '';
    return pad + (i ? '  ' : '- ') + line;
  });
}

interface PropAdderOptions {
  object: any;
  propName: string;
  comment?: string;
  defaultValue?: any;
}

function yamlPropAdder(lines: string[], withComments: boolean, options: PropAdderOptions): void {
  const { object, propName, defaultValue, comment } = options;

  var value = object[propName];
  if (value == null) {
    if (withComments && typeof defaultValue !== "undefined") {
      lines.push(
        '',
        `# ${comment}`,
        `#${propName}: ${defaultValue} # <- default`
      );
    }
  } else {
    if (withComments) lines.push(
      '',
      `# ${comment}`
    );
    lines.push(`${propName}: ${value}`);
  }
}

export function clusterToYAML(cluster: Cluster, withComments: boolean): string[] {
  var lines: string[] = [
    `name: ${cluster.name}`
  ];

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'type',
    comment: CLUSTER.type.description
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'host',
    comment: CLUSTER.host.description
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'version',
    comment: CLUSTER.version.description
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'timeout',
    comment: CLUSTER.timeout.description,
    defaultValue: Cluster.DEFAULT_TIMEOUT
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListScan',
    comment: CLUSTER.sourceListScan.description,
    defaultValue: Cluster.DEFAULT_SOURCE_LIST_SCAN
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListRefreshOnLoad',
    comment: CLUSTER.sourceListRefreshOnLoad.description,
    defaultValue: false
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceListRefreshInterval',
    comment: CLUSTER.sourceListRefreshInterval.description,
    defaultValue: Cluster.DEFAULT_SOURCE_LIST_REFRESH_INTERVAL
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceReintrospectOnLoad',
    comment: CLUSTER.sourceReintrospectOnLoad.description,
    defaultValue: false
  });

  yamlPropAdder(lines, withComments, {
    object: cluster,
    propName: 'sourceReintrospectInterval',
    comment: CLUSTER.sourceReintrospectInterval.description,
    defaultValue: Cluster.DEFAULT_SOURCE_REINTROSPECT_INTERVAL
  });

  if (withComments) {
    lines.push(
      '',
      `# Database specific (${cluster.type}) ===============`
    );
  }
  switch (cluster.type) {
    case 'druid':
      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'introspectionStrategy',
        comment: 'The introspection strategy for the Druid external.',
        defaultValue: Cluster.DEFAULT_INTROSPECTION_STRATEGY
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'requestDecorator',
        comment: 'The request decorator module filepath to load.'
      });
      break;

    case 'postgres':
    case 'mysql':
      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'database',
        comment: 'The database to which to connect to.'
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'user',
        comment: 'The user to connect as. This user needs no permissions other than SELECT.'
      });

      yamlPropAdder(lines, withComments, {
        object: cluster,
        propName: 'password',
        comment: 'The password to use with the provided user.'
      });
      break;
  }

  lines.push('');
  return yamlObject(lines);
}


export function attributeToYAML(attribute: AttributeInfo): string[] {
  var lines: string[] = [
    `name: ${attribute.name}`,
    `type: ${attribute.type}`
  ];

  if (attribute.special) {
    lines.push(`special: ${attribute.special}`);
  }

  lines.push('');
  return yamlObject(lines);
}

export function dimensionToYAML(dimension: Dimension): string[] {
  var lines: string[] = [
    `name: ${dimension.name}`,
    `title: ${dimension.title}`
  ];

  if (dimension.kind !== 'string') {
    lines.push(`kind: ${dimension.kind}`);
  }

  lines.push(`formula: ${dimension.formula}`);

  lines.push('');
  return yamlObject(lines);
}

export function measureToYAML(measure: Measure): string[] {
  var lines: string[] = [
    `name: ${measure.name}`,
    `title: ${measure.title}`
  ];

  lines.push(`formula: ${measure.formula}`);

  var format = measure.format;
  if (format !== Measure.DEFAULT_FORMAT) {
    lines.push(`format: ${format}`);
  }

  lines.push('');
  return yamlObject(lines);
}

export function dataCubeToYAML(dataCube: DataCube, withComments: boolean): string[] {
  var lines: string[] = [
    `name: ${dataCube.name}`,
    `title: ${dataCube.title}`,
    `clusterName: ${dataCube.clusterName}`,
    `source: ${dataCube.source}`
  ];

  var timeAttribute = dataCube.timeAttribute;
  if (timeAttribute && !(dataCube.clusterName === 'druid' && timeAttribute.name === '__time')) {
    if (withComments) {
      lines.push(`# The primary time attribute of the data refers to the attribute that must always be filtered on`);
      lines.push(`# This is particularly useful for Druid data cubes as they must always have a time filter.`);
    }
    lines.push(`timeAttribute: ${timeAttribute.name}`, '');
  }


  var refreshRule = dataCube.refreshRule;
  if (withComments) {
    lines.push("# The refresh rule describes how often the data cube looks for new data. Default: 'query'/PT1M (every minute)");
  }
  lines.push(`refreshRule:`);
  lines.push(`  rule: ${refreshRule.rule}`);
  if (refreshRule.time) {
    lines.push(`  time: ${refreshRule.time.toISOString()}`);
  }
  if (refreshRule.refresh) {
    lines.push(`  refresh: ${refreshRule.refresh.toString()}`);
  }
  lines.push('');

  yamlPropAdder(lines, withComments, {
    object: dataCube,
    propName: 'defaultTimezone',
    comment: DATA_CUBE.defaultTimezone.description,
    defaultValue: DataCube.DEFAULT_DEFAULT_TIMEZONE
  });

  yamlPropAdder(lines, withComments, {
    object: dataCube,
    propName: 'defaultDuration',
    comment: DATA_CUBE.defaultDuration.description,
    defaultValue: DataCube.DEFAULT_DEFAULT_DURATION
  });

  yamlPropAdder(lines, withComments, {
    object: dataCube,
    propName: 'defaultSortMeasure',
    comment: DATA_CUBE.defaultSortMeasure.description,
    defaultValue: dataCube.getDefaultSortMeasure()
  });

  var defaultSelectedMeasures = dataCube.defaultSelectedMeasures ? dataCube.defaultSelectedMeasures.toArray() : null;
  if (withComments) {
    lines.push('', "# The names of measures that are selected by default");
  }
  if (defaultSelectedMeasures) {
    lines.push(`defaultSelectedMeasures: ${JSON.stringify(defaultSelectedMeasures)}`);
  } else if (withComments) {
    lines.push(`#defaultSelectedMeasures: []`);
  }


  var defaultPinnedDimensions = dataCube.defaultPinnedDimensions ? dataCube.defaultPinnedDimensions.toArray() : null;
  if (withComments) {
    lines.push('', "# The names of dimensions that are pinned by default (in order that they will appear in the pin bar)");
  }
  if (defaultPinnedDimensions) {
    lines.push('', `defaultPinnedDimensions: ${JSON.stringify(defaultPinnedDimensions)}`);
  } else if (withComments) {
    lines.push('', `#defaultPinnedDimensions: []`);
  }


  var introspection = dataCube.getIntrospection();
  if (withComments) {
    lines.push(
      "",
      "# How the dataset should be introspected",
      "# possible options are:",
      "# * none - Do not do any introspection, take what is written in the config as the rule of law.",
      "# * no-autofill - Introspect the datasource but do not automatically generate dimensions or measures",
      "# * autofill-dimensions-only - Introspect the datasource, automatically generate dimensions only",
      "# * autofill-measures-only - Introspect the datasource, automatically generate measures only",
      "# * autofill-all - (default) Introspect the datasource, automatically generate dimensions and measures"
    );
  }
  lines.push(`introspection: ${introspection}`);


  var attributeOverrides = dataCube.attributeOverrides;
  if (withComments) {
    lines.push('', "# The list of attribute overrides in case introspection get something wrong");
  }
  lines.push('attributeOverrides:');
  if (withComments) {
    lines.push(
      "  # A general attribute override looks like so:",
      "  #",
      "  # name: user_unique",
      "  # ^ the name of the attribute (the column in the database)",
      "  #",
      "  # type: STRING",
      "  # ^ (optional) plywood type of the attribute",
      "  #",
      "  # special: unique",
      "  # ^ (optional) any kind of special significance associated with this attribute",
      ""
    );
  }
  lines = lines.concat.apply(lines, attributeOverrides.map(attributeToYAML));


  var dimensions = dataCube.dimensions.toArray();
  if (withComments) {
    lines.push('', "# The list of dimensions defined in the UI. The order here will be reflected in the UI");
  }
  lines.push('dimensions:');
  if (withComments) {
    lines.push(
      "  # A general dimension looks like so:",
      "  #",
      "  # name: channel",
      "  # ^ the name of the dimension as used in the URL (you should try not to change these)",
      "  #",
      "  # title: The Channel",
      "  # ^ (optional) the human readable title. If not set a title is generated from the 'name'",
      "  #",
      "  # kind: string",
      "  # ^ (optional) the kind of the dimension. Can be 'string', 'time', 'number', or 'boolean'. Defaults to 'string'",
      "  #",
      "  # formula: $channel",
      "  # ^ (optional) the Plywood bucketing expression for this dimension. Defaults to '$name'",
      "  #   if, say, channel was called 'cnl' in the data you would put '$cnl' here",
      "  #   See also the expressions API reference: https://plywood.imply.io/expressions",
      "  #",
      "  # url: string",
      "  # ^ (optional) a url (including protocol) associated with the dimension, with optional token '%s'",
      "  #   that is replaced by the dimension value to generate links specific to each value.",
      ""
    );
  }
  lines = lines.concat.apply(lines, dimensions.map(dimensionToYAML));
  if (withComments) {
    lines.push(
      "  # This is the place where you might want to add derived dimensions.",
      "  #",
      "  # Here are some examples of possible derived dimensions:",
      "  #",
      "  # - name: is_usa",
      "  #   title: Is USA?",
      "  #   formula: $country == 'United States'",
      "  #",
      "  # - name: file_version",
      "  #   formula: $filename.extract('(\\d+\\.\\d+\\.\\d+)')",
      ""
    );
  }


  var measures = dataCube.measures.toArray();
  if (withComments) {
    lines.push('', "# The list of measures defined in the UI. The order here will be reflected in the UI");
  }
  lines.push(`measures:`);
  if (withComments) {
    lines.push(
      "  # A general measure looks like so:",
      "  #",
      "  # name: avg_revenue",
      "  # ^ the name of the dimension as used in the URL (you should try not to change these)",
      "  #",
      "  # title: Average Revenue",
      "  # ^ (optional) the human readable title. If not set a title is generated from the 'name'",
      "  #",
      "  # formula: $main.sum($revenue) / $main.sum($volume) * 10",
      "  # ^ (optional) the Plywood bucketing expression for this dimension.",
      "  #   Usually defaults to '$main.sum($name)' but if the name contains 'min' or 'max' will use that as the aggregate instead of sum.",
      "  #   this is the place to define your fancy formulas",
      ""
    );
  }
  lines = lines.concat.apply(lines, measures.map(measureToYAML));
  if (withComments) {
    lines.push(
      "  # This is the place where you might want to add derived measures (a.k.a Post Aggregators).",
      "  #",
      "  # Here are some examples of possible derived measures:",
      "  #",
      "  # - name: ecpm",
      "  #   title: eCPM",
      "  #   formula: $main.sum($revenue) / $main.sum($impressions) * 1000",
      "  #",
      "  # - name: usa_revenue",
      "  #   title: USA Revenue",
      "  #   formula: $main.filter($country == 'United States').sum($revenue)",
      ""
    );
  }

  lines.push('');
  return yamlObject(lines);
}
