"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setSociety, setRadiusKm, adjustRadius, setPermission, setCoords } from "@/store/slices/locationSlice";

/** Wraps the browser Geolocation API + the society/radius selection described in §8. */
export function useLocation() {
  const dispatch = useDispatch();
  const { society, societies, radiusKm, permission, coords } = useSelector((s) => s.location);

  const requestBrowserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      dispatch(setPermission("denied"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        dispatch(setPermission("granted"));
        dispatch(setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      },
      () => dispatch(setPermission("denied")),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [dispatch]);

  return {
    society,
    societies,
    radiusKm,
    permission,
    coords,
    selectSociety: (name) => dispatch(setSociety(name)),
    setRadiusKm: (km) => dispatch(setRadiusKm(km)),
    adjustRadius: (dir) => dispatch(adjustRadius(dir)),
    requestBrowserLocation,
  };
}
