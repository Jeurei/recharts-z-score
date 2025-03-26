import React, { cloneElement, isValidElement } from 'react';
import { ActiveDotProps, ActiveDotType, adaptEventHandlers, DataKey } from '../util/types';
import { filterProps } from '../util/ReactUtils';
import { Dot } from '../shape/Dot';
import { Layer } from '../container/Layer';
import { useTooltipAxis } from '../context/useTooltipAxis';
import { findEntryInArray, isNullish } from '../util/DataUtils';
import { useAppSelector } from '../state/hooks';
import { selectActiveLabel, selectActiveTooltipIndex } from '../state/selectors/tooltipSelectors';

export interface PointType {
  readonly x: number;
  readonly y: number;
  readonly value?: any;
  readonly payload?: any;
  readonly isAnomaly?: boolean;
  readonly zScore?: number;
}

const renderActivePoint = ({
  point,
  childIndex,
  mainColor,
  activeDot,
  dataKey,
  points,
}: {
  point: PointType;
  activeDot: ActiveDotType;
  childIndex: number;
  dataKey: DataKey<any>;
  points: ReadonlyArray<PointType>;
  /**
   * Different graphical elements have different opinion on what is their main color.
   * Sometimes stroke, sometimes fill, sometimes combination.
   */
  mainColor: string;
}) => {
  if (activeDot === false) {
    return null;
  }

  const isAnomalous = () => {
    if (point.isAnomaly) return true;

    const currentZScore = point.zScore || point.payload?.zScore;
    if (currentZScore > 1) return true;

    const prevPointIndex = childIndex - 1;
    if (prevPointIndex >= 0 && points[prevPointIndex]) {
      const prevPoint = points[prevPointIndex];
      const prevZScore = prevPoint.zScore || prevPoint.payload?.zScore;
      if (prevZScore > 1) return true;
    }

    return false;
  };

  const dotProps: ActiveDotProps = {
    index: childIndex,
    dataKey,
    cx: point.x,
    cy: point.y,
    r: 4,
    fill: isAnomalous() ? 'red' : mainColor,
    strokeWidth: 2,
    stroke: '#fff',
    payload: point.payload,
    value: point.value,
    ...filterProps(activeDot, false),
    ...adaptEventHandlers(activeDot),
  };

  let dot;

  if (isValidElement(activeDot)) {
    // @ts-expect-error element cloning does not have types
    dot = cloneElement(activeDot, dotProps);
  } else if (typeof activeDot === 'function') {
    dot = activeDot(dotProps);
  } else {
    dot = <Dot {...dotProps} />;
  }

  return <Layer className="recharts-active-dot">{dot}</Layer>;
};

type ActivePointsProps = {
  points: ReadonlyArray<PointType>;
  mainColor: string;
  itemDataKey: DataKey<any>;
  activeDot: ActiveDotType;
};

export function ActivePoints({ points, mainColor, activeDot, itemDataKey }: ActivePointsProps) {
  const tooltipAxis = useTooltipAxis();
  const activeTooltipIndex = useAppSelector(selectActiveTooltipIndex);
  const activeLabel = useAppSelector(selectActiveLabel);
  if (!activeTooltipIndex) {
    return null;
  }

  let activePoint: PointType;

  const tooltipAxisDataKey = tooltipAxis.dataKey;
  if (tooltipAxisDataKey && !tooltipAxis.allowDuplicatedCategory) {
    const specifiedKey =
      typeof tooltipAxisDataKey === 'function'
        ? (point: PointType) => tooltipAxisDataKey(point.payload)
        : `payload.${tooltipAxisDataKey}`;
    activePoint = findEntryInArray(points, specifiedKey, activeLabel);
  } else {
    activePoint = points?.[Number(activeTooltipIndex)];
  }

  if (isNullish(activePoint)) {
    return null;
  }

  return renderActivePoint({
    point: activePoint,
    points,
    childIndex: Number(activeTooltipIndex),
    mainColor,
    dataKey: itemDataKey,
    activeDot,
  });
}
