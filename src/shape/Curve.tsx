/**
 * @fileOverview Curve
 */
import React, { Ref } from 'react';
import {
  line as shapeLine,
  area as shapeArea,
  CurveFactory,
  curveBasisClosed,
  curveBasisOpen,
  curveBasis,
  curveBumpX,
  curveBumpY,
  curveLinearClosed,
  curveLinear,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from 'victory-vendor/d3-shape';

import clsx from 'clsx';
import { nanoid } from '@reduxjs/toolkit';
import { LayoutType, PresentationAttributesWithProps, adaptEventHandlers } from '../util/types';
import { filterProps } from '../util/ReactUtils';
import { isNumber, upperFirst } from '../util/DataUtils';

interface CurveFactories {
  [index: string]: CurveFactory;
}

const CURVE_FACTORIES: CurveFactories = {
  curveBasisClosed,
  curveBasisOpen,
  curveBasis,
  curveBumpX,
  curveBumpY,
  curveLinearClosed,
  curveLinear,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
};

export type CurveType =
  | 'basis'
  | 'basisClosed'
  | 'basisOpen'
  | 'bumpX'
  | 'bumpY'
  | 'bump'
  | 'linear'
  | 'linearClosed'
  | 'natural'
  | 'monotoneX'
  | 'monotoneY'
  | 'monotone'
  | 'step'
  | 'stepBefore'
  | 'stepAfter'
  | CurveFactory;

export interface Point {
  readonly x: number;
  readonly y: number;
  readonly zScore?: number;
}

const defined = (p: Point) => p.x === +p.x && p.y === +p.y;
const getX = (p: Point) => p.x;
const getY = (p: Point) => p.y;

const getCurveFactory = (type: CurveType, layout: LayoutType) => {
  if (typeof type === 'function') {
    return type;
  }

  const name = `curve${upperFirst(type)}`;

  if ((name === 'curveMonotone' || name === 'curveBump') && layout) {
    return CURVE_FACTORIES[`${name}${layout === 'vertical' ? 'Y' : 'X'}`];
  }
  return CURVE_FACTORIES[name] || curveLinear;
};

interface CurveProps {
  className?: string;
  type?: CurveType;
  layout?: LayoutType;
  baseLine?: number | ReadonlyArray<Point>;
  points?: ReadonlyArray<Point>;
  connectNulls?: boolean;
  path?: string;
  pathRef?: Ref<SVGPathElement>;
}

export type Props = Omit<PresentationAttributesWithProps<CurveProps, SVGPathElement>, 'type' | 'points'> & CurveProps;

type GetPathProps = Pick<Props, 'type' | 'points' | 'baseLine' | 'layout' | 'connectNulls'>;

const renderHighlightSegments = (
  highlightSegments: Array<{ segment: Point[]; contextPoints: Point[] }>,
  realPath: string | null,
  className?: string,
) => {
  return highlightSegments.map(({ segment, contextPoints }) => {
    if (!realPath || segment.length === 0 || !segment[0]) return null;

    const clipId = `z-score-clip-${nanoid()}`;
    const anomalyPoint = segment[0];
    let [minX, maxX, minY, maxY] = [anomalyPoint.x, anomalyPoint.x, anomalyPoint.y, anomalyPoint.y];
    const pointIndex = contextPoints.findIndex(p => p.x === anomalyPoint.x && p.y === anomalyPoint.y);
    const endIdx = Math.min(contextPoints.length - 1, pointIndex + 1);

    for (let i = pointIndex; i <= endIdx; i++) {
      const p = contextPoints[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 1;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    return (
      <g key={clipId} className="recharts-curve-anomaly">
        <defs>
          <clipPath id={clipId}>
            <rect x={minX} y={minY} width={width} height={height} />
          </clipPath>
        </defs>
        <path
          className={clsx('recharts-curve-anomaly-path', className)}
          stroke="red"
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          d={realPath}
          clipPath={`url(#${clipId})`}
        />
      </g>
    );
  });
};

/**
 * Calculate the path of curve. Returns null if points is an empty array.
 * @return path or null
 */
export const getPath = ({
  type = 'linear',
  points = [],
  baseLine,
  layout,
  connectNulls = false,
}: GetPathProps): string | null => {
  const curveFactory = getCurveFactory(type, layout);
  const formatPoints = connectNulls ? points.filter(entry => defined(entry)) : points;
  let lineFunction;

  if (Array.isArray(baseLine)) {
    const formatBaseLine = connectNulls ? baseLine.filter(base => defined(base)) : baseLine;
    const areaPoints = formatPoints.map((entry, index) => ({ ...entry, base: formatBaseLine[index] }));
    if (layout === 'vertical') {
      lineFunction = shapeArea<Point & { base: Point }>()
        .y(getY)
        .x1(getX)
        .x0(d => d.base.x);
    } else {
      lineFunction = shapeArea<Point & { base: Point }>()
        .x(getX)
        .y1(getY)
        .y0(d => d.base.y);
    }
    lineFunction.defined(defined).curve(curveFactory);

    return lineFunction(areaPoints);
  }
  if (layout === 'vertical' && isNumber(baseLine)) {
    lineFunction = shapeArea<Point>().y(getY).x1(getX).x0(baseLine);
  } else if (isNumber(baseLine)) {
    lineFunction = shapeArea<Point>().x(getX).y1(getY).y0(baseLine);
  } else {
    lineFunction = shapeLine<Point>().x(getX).y(getY);
  }

  lineFunction.defined(defined).curve(curveFactory);

  return lineFunction(formatPoints);
};

export const Curve: React.FC<Props> = props => {
  const { className, points, path, pathRef } = props;

  if ((!points || !points.length) && !path) {
    return null;
  }

  const realPath = points && points.length ? getPath(props) : path;

  const highlightSegments: Array<{
    segment: Point[];
    contextPoints: Point[];
  }> = [];

  if (points && points.length > 0) {
    points.forEach((point, i) => {
      if (point.zScore > 1) {
        const segment = [point];

        const contextStartIdx = Math.max(0, i - 2);
        const contextEndIdx = Math.min(points.length - 1, i + 2);
        const contextPoints = points.slice(contextStartIdx, contextEndIdx + 1);

        highlightSegments.push({
          segment,
          contextPoints,
        });
      }
    });
  }

  return (
    <>
      <path
        {...filterProps(props, false)}
        {...adaptEventHandlers(props)}
        className={clsx('recharts-curve', className)}
        d={realPath}
        ref={pathRef}
      />
      {highlightSegments.length > 0 && renderHighlightSegments(highlightSegments, realPath, className)}
    </>
  );
};
