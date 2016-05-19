import { Manifest } from '../../common/models/index';

import { Totals } from './totals/totals';
import { Table } from './table/table';
import { TimeSeries } from './time-series/time-series';
import { BarChart } from './bar-chart/bar-chart';
import { Geo } from './geo/geo';

export var visualizations: Manifest[] = [
  Totals,
  Table,
  TimeSeries,
  BarChart,
  Geo
];
