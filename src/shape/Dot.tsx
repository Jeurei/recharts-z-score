/**
 * @fileOverview Dot
 */
import React from 'react';
import clsx from 'clsx';
import { PresentationAttributesWithProps, adaptEventHandlers } from '../util/types';
import { filterProps } from '../util/ReactUtils';

interface DotProps {
  className?: string;
  cx?: number;
  cy?: number;
  r?: number;
  clipDot?: boolean;
  isAnomaly?: boolean;
}

export type Props = PresentationAttributesWithProps<DotProps, SVGCircleElement> & DotProps;

export const Dot: React.FC<Props> = props => {
  const { cx, cy, r, className, isAnomaly } = props;
  const layerClass = clsx('recharts-dot', className);
  const filtredProps = filterProps(props, false);

  if (cx === +cx && cy === +cy && r === +r) {
    return (
      <circle
        {...filtredProps}
        {...adaptEventHandlers(props)}
        className={layerClass}
        cx={cx}
        cy={cy}
        r={r}
        stroke={isAnomaly ? 'red' : filtredProps.stroke}
      />
    );
  }

  return null;
};
