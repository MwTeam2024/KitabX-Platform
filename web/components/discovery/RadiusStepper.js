'use client';

import Icon from '@/components/ui/Icon';
import { useLocation } from '@/hooks/useLocation';
import { MAX_RADIUS_KM, MIN_RADIUS_KM } from '@/lib/constants';

/**
 * Discovery-radius control. The frontend only picks the number — the actual
 * PostGIS radius query runs in NestJS (§8).
 */
export default function RadiusStepper() {
  const { radiusKm, adjustRadius } = useLocation();

  return (
    <div className="radius-row">
      <div className="radius-l"><Icon name="mapPin" />Discovery radius</div>
      <div className="stepper">
        <button
          className="step-circ"
          onClick={() => adjustRadius(-1)}
          disabled={radiusKm <= MIN_RADIUS_KM}
          aria-label="Decrease radius"
        >−</button>
        <span className="step-val">{radiusKm.toFixed(1)} km</span>
        <button
          className="step-circ"
          onClick={() => adjustRadius(1)}
          disabled={radiusKm >= MAX_RADIUS_KM}
          aria-label="Increase radius"
        >+</button>
      </div>
    </div>
  );
}
