require('./line-chart.css');

import { BaseVisualization, BaseVisualizationState } from '../base-visualization/base-visualization';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { r, $, ply, Executor, Expression, Dataset, Datum, TimeRange, TimeRangeJS, TimeBucketAction, SortAction,
  PlywoodRange, NumberRangeJS, NumberRange, LiteralExpression, Set, Range, NumberBucketAction } from 'plywood';
import { Splits, Colors, FilterClause, Dimension, Stage, Filter, Measure, DataSource, VisualizationProps, DatasetLoad, Resolve } from '../../../common/models/index';
import { DisplayYear } from '../../../common/utils/time/time';
import { rangeEquals } from '../../../common/utils/general/general';
import { formatValue } from '../../../common/utils/formatter/formatter';

import { getLineChartTicks } from '../../../common/models/granularity/granularity';

import { SPLIT, VIS_H_PADDING } from '../../config/constants';
import { getXFromEvent, escapeKey } from '../../utils/dom/dom';
import { VisMeasureLabel } from '../../components/vis-measure-label/vis-measure-label';
import { ChartLine } from '../../components/chart-line/chart-line';
import { LineChartAxis } from '../../components/line-chart-axis/line-chart-axis';
import { VerticalAxis } from '../../components/vertical-axis/vertical-axis';
import { GridLines } from '../../components/grid-lines/grid-lines';
import { Highlighter } from '../../components/highlighter/highlighter';
import { SegmentBubble } from '../../components/segment-bubble/segment-bubble';
import { HoverMultiBubble, ColorEntry } from '../../components/hover-multi-bubble/hover-multi-bubble';

import handler from './circumstances';

const TEXT_SPACER = 36;
const X_AXIS_HEIGHT = 30;
const Y_AXIS_WIDTH = 60;
const MIN_CHART_HEIGHT = 140;
const HOVER_BUBBLE_V_OFFSET = -7;
const HOVER_MULTI_BUBBLE_V_OFFSET = -8;
const MAX_HOVER_DIST = 50;
const MAX_ASPECT_RATIO = 1; // width / height

function findClosest(data: Datum[], dragDate: Date, scaleX: (v: continuousValueType) => number, dimension: Dimension) {
  var closestDatum: Datum = null;
  var minDist = Infinity;
  for (var datum of data) {
    var segmentValue = datum[dimension.name] as (TimeRange | NumberRange);
    if (!segmentValue) continue;
    var mid = segmentValue.midpoint();
    var dist = Math.abs(mid.valueOf() - dragDate.valueOf());
    var distPx = Math.abs(scaleX(mid) - scaleX(dragDate));
    if ((!closestDatum || dist < minDist) && distPx < MAX_HOVER_DIST) { // Make sure it is not too far way
      closestDatum = datum;
      minDist = dist;
    }
  }
  return closestDatum;
}

function roundTo(v: number, roundTo: number) {
  return Math.round(Math.floor(v / roundTo)) * roundTo;
}

export type continuousValueType = Date | number;

export interface LineChartState extends BaseVisualizationState {
  dragStartValue?: continuousValueType;
  dragRange?: PlywoodRange;
  roundDragRange?: PlywoodRange;
  hoverRange?: PlywoodRange;

  // Cached props
  dimension?: Dimension;
  axisRange?: PlywoodRange;
  scaleX?: any;
  xTicks?: continuousValueType[];
}


export class LineChart extends BaseVisualization<LineChartState> {
  public static id = 'line-chart';
  public static title = 'Line Chart';

  public static handleCircumstance = handler.evaluate.bind(handler);

  constructor() {
    super();
  }

  getDefaultState(): LineChartState {
    var s = super.getDefaultState() as LineChartState;

    s.dragStartValue = null;
    s.dragRange = null;
    s.hoverRange = null;

    return s;
  }


  getMyEventX(e: MouseEvent): number {
    var myDOM = ReactDOM.findDOMNode(this);
    var rect = myDOM.getBoundingClientRect();
    return getXFromEvent(e) - (rect.left + VIS_H_PADDING);
  }

  onMouseDown(measure: Measure, e: MouseEvent) {
    const { scaleX } = this.state;
    if (!scaleX) return;

    var dragStartValue = scaleX.invert(this.getMyEventX(e));
    this.setState({
      dragStartValue,
      dragRange: null,
      dragOnMeasure: measure
    });
  }

  onMouseMove(dataset: Dataset, measure: Measure, scaleX: any, e: MouseEvent) {
    var { essence } = this.props;
    var { dimension, hoverRange, hoverMeasure } = this.state;
    if (!dataset) return;

    var splitLength = essence.splits.length();

    var myDOM = ReactDOM.findDOMNode(this);
    var rect = myDOM.getBoundingClientRect();
    var dragDate = scaleX.invert(getXFromEvent(e) - (rect.left + VIS_H_PADDING));

    var closestDatum: Datum;
    if (splitLength > 1) {
      var flatData = dataset.flatten();
      closestDatum = findClosest(flatData, dragDate, scaleX, dimension);
    } else {
      closestDatum = findClosest(dataset.data, dragDate, scaleX, dimension);
    }

    var currentHoverRange: any = closestDatum ? (closestDatum[dimension.name]) : null;

    if (!hoverRange || !rangeEquals(hoverRange, currentHoverRange) || measure !== hoverMeasure) {
      this.setState({
        hoverRange: currentHoverRange,
        hoverMeasure: measure
      });
    }
  }

  getDragRange(e: MouseEvent): PlywoodRange {
    const { dragStartValue, axisRange, scaleX } = this.state;

    var dragEndValue = scaleX.invert(this.getMyEventX(e));
    var rangeJS: TimeRangeJS | NumberRangeJS = null;

    if (dragStartValue.valueOf() === dragEndValue.valueOf()) {
      dragEndValue = TimeRange.isTimeRange(axisRange) ? new Date(dragEndValue.valueOf() + 1) : dragEndValue + 1;
    }

    if (dragStartValue < dragEndValue) {
      rangeJS = { start: dragStartValue, end: dragEndValue };
    } else {
      rangeJS = { start: dragEndValue, end: dragStartValue };
    }

    return Range.fromJS(rangeJS).intersect(axisRange);

  }

  floorRange(dragRange: PlywoodRange): PlywoodRange {
    const { essence } = this.props;
    const { splits, timezone } = essence;
    var lastSplit = splits.last();

    if (TimeRange.isTimeRange(dragRange)) {
      var timeBucketAction = lastSplit.bucketAction as TimeBucketAction;
      var duration = timeBucketAction.duration;
      return TimeRange.fromJS({
        start: duration.floor(dragRange.start, timezone),
        end: duration.shift(duration.floor(dragRange.end, timezone), timezone, 1)
      });
    } else {
      var numberBucketAction = lastSplit.bucketAction as NumberBucketAction;
      var bucketSize = numberBucketAction.size;
      var startFloored = roundTo((dragRange as NumberRange).start, bucketSize);
      var endFloored = roundTo((dragRange as NumberRange).end, bucketSize);

      if (endFloored - startFloored < bucketSize) {
        endFloored += bucketSize;
      }

      return NumberRange.fromJS({
        start: startFloored,
        end: endFloored
      });
    }

  }

  globalMouseMoveListener(e: MouseEvent) {
    const { dragStartValue } = this.state;
    if (dragStartValue === null) return;

    var dragRange = this.getDragRange(e);
    this.setState({
      dragRange,
      roundDragRange: this.floorRange(dragRange)
    });
  }

  globalMouseUpListener(e: MouseEvent) {
    const { clicker, essence } = this.props;
    const { dimension, dragStartValue, dragRange, dragOnMeasure } = this.state;
    if (dragStartValue === null) return;

    var highlightRange = this.floorRange(this.getDragRange(e));
    this.resetDrag();

    // If already highlighted and user clicks within it switches measure
    if (!dragRange && essence.highlightOn(LineChart.id)) {
      var existingHighlightTimeRange = essence.getSingleHighlightSet().elements[0];
      if (existingHighlightTimeRange.contains(highlightRange.start)) {
        var { highlight } = essence;
        if (highlight.measure === dragOnMeasure.name) {
          clicker.dropHighlight();
        } else {
          clicker.changeHighlight(
            LineChart.id,
            dragOnMeasure.name,
            highlight.delta
          );
        }
        return;
      }
    }

    clicker.changeHighlight(
      LineChart.id,
      dragOnMeasure.name,
      Filter.fromClause(new FilterClause({
        expression: dimension.expression,
        selection: r(highlightRange)
      }))
    );
  }

  globalKeyDownListener(e: KeyboardEvent) {
    if (!escapeKey(e)) return;

    const { dragStartValue } = this.state;
    if (dragStartValue === null) return;

    this.resetDrag();
  }

  resetDrag() {
    this.setState({
      dragStartValue: null,
      dragRange: null,
      roundDragRange: null,
      dragOnMeasure: null
    });
  }

  onMouseLeave(measure: Measure, e: MouseEvent) {
    const { hoverMeasure } = this.state;
    if (hoverMeasure === measure) {
      this.setState({
        hoverRange: null,
        hoverMeasure: null
      });
    }
  }

  renderHighlighter(): JSX.Element {
    const { essence } = this.props;
    const { dragRange, scaleX } = this.state;

    if (dragRange !== null) {
      return <Highlighter highlightRange={dragRange} scaleX={scaleX}/>;
    }
    if (essence.highlightOn(LineChart.id)) {
      var highlightRange = essence.getSingleHighlightSet().elements[0];
      return <Highlighter highlightRange={highlightRange} scaleX={scaleX}/>;
    }
    return null;
  }

  renderChartBubble(dataset: Dataset, measure: Measure, chartIndex: number, containerStage: Stage, chartStage: Stage, extentY: number[], scaleY: any): JSX.Element {
    const { clicker, essence, openRawDataModal } = this.props;
    const { scrollTop, dragRange, roundDragRange, dragOnMeasure, hoverRange, hoverMeasure, scaleX, dimension } = this.state;
    const { colors, timezone } = essence;

    if (essence.highlightOnDifferentMeasure(LineChart.id, measure.name)) return null;

    var topOffset = chartStage.height * chartIndex + scaleY(extentY[1]) + TEXT_SPACER - scrollTop;
    if (topOffset < 0) return null;
    topOffset += containerStage.y;

    if ((dragRange && dragOnMeasure === measure) || (!dragRange && essence.highlightOn(LineChart.id, measure.name))) {
      var bubbleTimeRange = dragRange || essence.getSingleHighlightSet().elements[0];

      var shownTimeRange = roundDragRange || bubbleTimeRange;
      var segmentLabel = formatValue(bubbleTimeRange, timezone, DisplayYear.NEVER);

      if (colors) {
        var categoryDimension = essence.splits.get(0).getDimension(essence.dataSource.dimensions);
        var leftOffset = containerStage.x + VIS_H_PADDING + scaleX(bubbleTimeRange.end);

        var hoverDatums = dataset.data.map(d => (d[SPLIT] as Dataset).findDatumByAttribute(dimension.name, bubbleTimeRange));
        var colorValues = colors.getColors(dataset.data.map(d => d[categoryDimension.name]));
        var colorEntries: ColorEntry[] = dataset.data.map((d, i) => {
          var segment = d[categoryDimension.name];
          var hoverDatum = hoverDatums[i];
          if (!hoverDatum) return null;

          return {
            color: colorValues[i],
            segmentLabel: String(segment),
            measureLabel: measure.formatDatum(hoverDatum)
          };
        }).filter(Boolean);

        return <HoverMultiBubble
          left={leftOffset}
          top={topOffset + HOVER_MULTI_BUBBLE_V_OFFSET}
          segmentLabel={segmentLabel}
          colorEntries={colorEntries}
          clicker={dragRange ? null : clicker}
        />;
      } else {
        var leftOffset = containerStage.x + VIS_H_PADDING + scaleX(bubbleTimeRange.midpoint());
        var highlightDatum = dataset.findDatumByAttribute(dimension.name, shownTimeRange);
        var segmentLabel = formatValue(shownTimeRange, timezone, DisplayYear.NEVER);

        return <SegmentBubble
          left={leftOffset}
          top={topOffset + HOVER_BUBBLE_V_OFFSET}
          segmentLabel={segmentLabel}
          measureLabel={highlightDatum ? measure.formatDatum(highlightDatum) : null}
          clicker={dragRange ? null : clicker}
          openRawDataModal={openRawDataModal}
        />;
      }

    } else if (!dragRange && hoverRange && hoverMeasure === measure) {
      var leftOffset = containerStage.x + VIS_H_PADDING + scaleX((hoverRange as NumberRange | TimeRange).midpoint());
      var segmentLabel = formatValue(hoverRange, timezone, DisplayYear.NEVER);

      if (colors) {
        var categoryDimension = essence.splits.get(0).getDimension(essence.dataSource.dimensions);
        var hoverDatums = dataset.data.map(d => (d[SPLIT] as Dataset).findDatumByAttribute(dimension.name, hoverRange));
        var colorValues = colors.getColors(dataset.data.map(d => d[categoryDimension.name]));
        var colorEntries: ColorEntry[] = dataset.data.map((d, i) => {
          var segment = d[categoryDimension.name];
          var hoverDatum = hoverDatums[i];
          if (!hoverDatum) return null;

          return {
            color: colorValues[i],
            segmentLabel: String(segment),
            measureLabel: measure.formatDatum(hoverDatum)
          };
        }).filter(Boolean);
        return <HoverMultiBubble
          left={leftOffset}
          top={topOffset + HOVER_MULTI_BUBBLE_V_OFFSET}
          segmentLabel={segmentLabel}
          colorEntries={colorEntries}
        />;

      } else {
        var hoverDatum = dataset.findDatumByAttribute(dimension.name, hoverRange);
        if (!hoverDatum) return null;
        var segmentLabel = formatValue(hoverRange, timezone, DisplayYear.NEVER);

        return <SegmentBubble
          left={leftOffset}
          top={topOffset + HOVER_BUBBLE_V_OFFSET}
          segmentLabel={segmentLabel}
          measureLabel={measure.formatDatum(hoverDatum)}
        />;

      }

    }

    return null;
  }

  renderChart(dataset: Dataset, measure: Measure, chartIndex: number, containerStage: Stage, chartStage: Stage): JSX.Element {
    const { essence } = this.props;
    const { hoverRange, hoverMeasure, dragRange, scaleX, xTicks, dimension } = this.state;
    const { splits, colors } = essence;
    var splitLength = splits.length();

    var lineStage = chartStage.within({ top: TEXT_SPACER, right: Y_AXIS_WIDTH, bottom: 1 }); // leave 1 for border
    var yAxisStage = chartStage.within({ top: TEXT_SPACER, left: lineStage.width, bottom: 1 });

    var measureName = measure.name;
    var getX = (d: Datum) => d[dimension.name] as (TimeRange | NumberRange);
    var getY = (d: Datum) => d[measureName] as number;

    var myDatum: Datum = dataset.data[0];
    var mySplitDataset = myDatum[SPLIT] as Dataset;

    var extentY: number[] = null;
    if (splitLength === 1) {
      extentY = d3.extent(mySplitDataset.data, getY);
    } else {
      var minY = 0;
      var maxY = 0;

      mySplitDataset.data.forEach(datum => {
        var subDataset = datum[SPLIT] as Dataset;
        if (subDataset) {
          var tempExtentY = d3.extent(subDataset.data, getY);
          minY = Math.min(tempExtentY[0], minY);
          maxY = Math.max(tempExtentY[1], maxY);
        }
      });

      extentY = [minY, maxY];
    }

    var horizontalGridLines: JSX.Element;
    var chartLines: JSX.Element[];
    var verticalAxis: JSX.Element;
    var bubble: JSX.Element;
    if (!isNaN(extentY[0]) && !isNaN(extentY[1])) {
      let scaleY = d3.scale.linear()
        .domain([Math.min(extentY[0] * 1.1, 0), Math.max(extentY[1] * 1.1, 0)])
        .range([lineStage.height, 0]);

      let yTicks = scaleY.ticks(5).filter((n: number) => n !== 0);

      horizontalGridLines = <GridLines
        orientation="horizontal"
        scale={scaleY}
        ticks={yTicks}
        stage={lineStage}
      />;

      verticalAxis = <VerticalAxis
        stage={yAxisStage}
        ticks={yTicks}
        scale={scaleY}
      />;

      if (splitLength === 1) {
        chartLines = [];
        chartLines.push(<ChartLine
          key='single'
          dataset={mySplitDataset}
          getX={getX}
          getY={getY}
          scaleX={scaleX}
          scaleY={scaleY}
          stage={lineStage}
          showArea={true}
          hoverRange={(!dragRange && hoverMeasure === measure) ? hoverRange : null}
          color="default"
        />);
      } else {
        var colorValues: string[] = null;
        var categoryDimension = essence.splits.get(0).getDimension(essence.dataSource.dimensions);

        if (colors) colorValues = colors.getColors(mySplitDataset.data.map(d => d[categoryDimension.name]));

        chartLines = mySplitDataset.data.map((datum, i) => {
          var subDataset = datum[SPLIT] as Dataset;
          if (!subDataset) return null;
          return <ChartLine
            key={'single' + i}
            dataset={subDataset}
            getX={getX}
            getY={getY}
            scaleX={scaleX}
            scaleY={scaleY}
            stage={lineStage}
            showArea={false}
            hoverRange={(!dragRange && hoverMeasure === measure) ? hoverRange : null}
            color={colorValues ? colorValues[i] : null}
          />;
        });
      }

      bubble = this.renderChartBubble(mySplitDataset, measure, chartIndex, containerStage, chartStage, extentY, scaleY);
    }

    return <div
      className="measure-line-chart"
      key={measureName}
      onMouseDown={this.onMouseDown.bind(this, measure)}
      onMouseMove={this.onMouseMove.bind(this, mySplitDataset, measure, scaleX)}
      onMouseLeave={this.onMouseLeave.bind(this, measure)}
    >
      <svg style={chartStage.getWidthHeight()} viewBox={chartStage.getViewBox()}>
        {horizontalGridLines}
        <GridLines
          orientation="vertical"
          scale={scaleX}
          ticks={xTicks}
          stage={lineStage}
        />
        {chartLines}
        {verticalAxis}
        <line
          className="vis-bottom"
          x1="0"
          y1={chartStage.height - 0.5}
          x2={chartStage.width}
          y2={chartStage.height - 0.5}
        />
      </svg>
      <VisMeasureLabel measure={measure} datum={myDatum}/>
      {this.renderHighlighter()}
      {bubble}
    </div>;

  }

  precalculate(props: VisualizationProps, datasetLoad: DatasetLoad = null) {
    const { registerDownloadableDataset, essence, stage } = props;
    const { splits, timezone } = essence;

    var existingDatasetLoad = this.state.datasetLoad;
    var newState: LineChartState = {};
    if (datasetLoad) {
      // Always keep the old dataset while loading (for now)
      if (datasetLoad.loading) datasetLoad.dataset = existingDatasetLoad.dataset;

      newState.datasetLoad = datasetLoad;
    } else {
      datasetLoad = this.state.datasetLoad;
    }

    if (splits.length()) {
      var { dataset } = datasetLoad;
      if (dataset) {
        if (registerDownloadableDataset) registerDownloadableDataset(dataset);
      }

      var chartSplit = splits.length() === 1 ? splits.get(0) : splits.get(1);
      var dimension = chartSplit.getDimension(essence.dataSource.dimensions);
      if (dimension) {
        newState.dimension = dimension;

        var axisRange = essence.getEffectiveFilter(LineChart.id).getExtent(dimension.expression) as PlywoodRange;

        // Not filtered on time or has unbounded filter
        if ((!axisRange && dataset) || (dataset && (!axisRange.start || !axisRange.end))) {
          var myDataset = dataset.data[0]['SPLIT'] as Dataset;

          var start = (myDataset.data[0][dimension.name] as NumberRange | TimeRange).start;
          var end = (myDataset.data[myDataset.data.length - 1][dimension.name] as NumberRange | TimeRange).end;

          // right now dataset might not be sorted properly
          if (start < end ) axisRange = Range.fromJS({start, end});
        }

        if (axisRange) {
          newState.axisRange = axisRange;
          let domain = [(axisRange).start, (axisRange).end];
          let range = [0, stage.width - VIS_H_PADDING * 2 - Y_AXIS_WIDTH];
          let scaleFn: any = null;
          if (dimension.kind === 'time') {
            scaleFn = d3.time.scale();
          } else {
            scaleFn = d3.scale.linear();
          }

          newState.scaleX = scaleFn.domain(domain).range(range);
          newState.xTicks = getLineChartTicks(axisRange, timezone);
        }
      }
    }

    this.setState(newState);
  }

  renderInternals() {
    var { essence, stage } = this.props;
    var { datasetLoad, axisRange, scaleX, xTicks } = this.state;
    var { splits, timezone } = essence;

    var measureCharts: JSX.Element[];
    var bottomAxis: JSX.Element;

    if (datasetLoad.dataset && splits.length() && axisRange) {
      var measures = essence.getEffectiveMeasures().toArray();

      var chartWidth = stage.width - VIS_H_PADDING * 2;
      var chartHeight = Math.max(
        MIN_CHART_HEIGHT,
        Math.floor(Math.min(
          chartWidth / MAX_ASPECT_RATIO,
          (stage.height - X_AXIS_HEIGHT) / measures.length
        ))
      );
      var chartStage = new Stage({
        x: VIS_H_PADDING,
        y: 0,
        width: chartWidth,
        height: chartHeight
      });

      measureCharts = measures.map((measure, chartIndex) => {
        return this.renderChart(datasetLoad.dataset, measure, chartIndex, stage, chartStage);
      });

      var xAxisStage = Stage.fromSize(chartStage.width, X_AXIS_HEIGHT);
      bottomAxis = <svg
        className="bottom-axis"
        width={xAxisStage.width}
        height={xAxisStage.height}
      >
        <LineChartAxis stage={xAxisStage} ticks={xTicks} scale={scaleX} timezone={timezone}/>
      </svg>;
    }

    var measureChartsStyle = {
      maxHeight: stage.height - X_AXIS_HEIGHT
    };

    return <div className="internals line-chart-inner">
      <div className="measure-line-charts" style={measureChartsStyle} onScroll={this.onScroll.bind(this)}>
        {measureCharts}
      </div>
      {bottomAxis}
    </div>;
  }
}