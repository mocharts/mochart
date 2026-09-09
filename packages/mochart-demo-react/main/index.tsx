import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router';

import { demoText, phoneFallbackDemoMode, shareHashPrefix } from '@mochart/demo-common';

import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@mochart/demo-common/demo.css';
import '@mochart/editor/editor.css';

import demoData from '@mochart/demo-data';

import type { SwitchableDemoMode } from '@mochart/demo-common';

import GalleryPage from '../src/components/gallery/GalleryPage';
import DemoSingle from '../src/components/single/DemoSingle';
import DemoMulti from '../src/components/multi/DemoMulti';
import DemoRandom from '../src/components/random/DemoRandom';
import DemoTransition from '../src/components/transition/DemoTransition';
import DemoRotation from '../src/components/rotation/DemoRotation';
import DemoSparkline from '../src/components/sparkline/DemoSparkline';

import { usePhoneViewport } from '../src/components/misc/usePhoneViewport';

import type { DemoTabProps } from '../src/types';

interface DemoWindowConfig {
  routerBasePath?: string;
}

const { demoObjectMap } = demoData;

let routerBasePath = '/';

const config = (window as unknown as { __config?: DemoWindowConfig })['__config'];
if (config !== undefined) {
  if (config['routerBasePath'] !== undefined) {
    routerBasePath = config['routerBasePath'];
  }
}

// The site build injects VITE_SITE_ROOT (the docs site root) so the demo can
// link back to it; standalone dev/build leaves it unset and no link renders.
// Every view places the link itself (top-left, before its own navigation).
// For styling/debugging without a site build, `?siteRoot` forces the button
// (linking to `/`), and `?siteRoot=<url>` points it at a specific target.
function getDebugSiteRootUrl(): string | undefined {
  const param = new URLSearchParams(window.location.search).get('siteRoot');
  if (param === null) {
    return undefined;
  }
  return param === '' ? '/' : param;
}

const siteRootUrl = (import.meta.env.VITE_SITE_ROOT as string | undefined) ?? getDebugSiteRootUrl();

function RouteNotFound() {
  const location = useLocation();
  return <div className="mochart-demo-message"><div className="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.noRoute(location.pathname)}</div></div>;
}

// Query params (e.g. the ?siteRoot debug switch) are carried across every
// navigation; routes themselves only ever use the pathname.
function useDemoNavigate() {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Returns void, not the router's promise: every caller is a click handler or
  // a `void`-typed prop, and leaking the promise upward made each of them an
  // unhandled-rejection site.
  return (pathname: string, options: { replace?: boolean } = {}): void => {
    void navigate({ pathname, search }, options);
  };
}

// A share link's payload lives in the URL hash; the mounted view decodes it on
// its first render (consumeShareState). React Router owns the location and
// re-asserts the hash-bearing URL during mount, so clearing it must go through
// the router — do it once, after the child has consumed the payload. Replacing
// only the hash keeps the same route, so the view isn't remounted and its
// restored state survives.
function useClearShareHash() {
  const location = useLocation();
  const navigate = useNavigate();
  const cleared = useRef(false);
  useEffect(() => {
    if (!cleared.current && location.hash.startsWith(shareHashPrefix)) {
      cleared.current = true;
      void navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true });
    }
  }, [location, navigate]);
}

/** Redirect (replace-style) that preserves the current query string. */
function RedirectWithSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

function RandomRedirect() {
  const { demoId } = useParams();
  return <RedirectWithSearch to={`/random/${demoId}/0`} />;
}

function GalleryRoute() {
  const demoNavigate = useDemoNavigate();
  return <GalleryPage demoData={demoData} siteRootUrl={siteRootUrl}
    onOpenDemo={demoId => demoNavigate(`/single/${demoId}`)}
    onOpenPage={mode => demoNavigate(`/${mode}`)} />;
}

// The gallery at /demos is the landing route; a demo is always viewed at
// /<mode>/<demoId>. Switching mode keeps the current demo.
function useDemoNavigation(demoId: string) {
  const demoNavigate = useDemoNavigate();
  const onModeChanged = (nextDemoMode: SwitchableDemoMode) => {
    if (nextDemoMode === 'random') {
      demoNavigate(`/random/${demoId}/0`);
    }
    else {
      demoNavigate(`/${nextDemoMode}/${demoId}`);
    }
  };
  const onBackToDemos = () => demoNavigate('/demos');
  return { onModeChanged, onBackToDemos };
}

function useBackToDemos() {
  const demoNavigate = useDemoNavigate();
  return () => demoNavigate('/demos');
}

interface DemoModeRouteProps {
  Component: React.ComponentType<DemoTabProps>;
}

function DemoModeRoute({ Component }: DemoModeRouteProps) {
  const params = useParams();
  const demoId = params.demoId!;
  const nav = useDemoNavigation(demoId);
  useClearShareHash();
  if (demoObjectMap[demoId] === undefined) {
    return <div className="mochart-demo-message"><div className="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.noDemo(demoId)}</div></div>;
  }
  return <Component demoData={demoData} initialDemoId={demoId} siteRootUrl={siteRootUrl}
    onModeChanged={nav.onModeChanged} onBackToDemos={nav.onBackToDemos} />;
}

// A phone has no room for Multi's grid of charts, so its URL falls back to the
// same demo in Single. Driving it off the viewport state means a rotation into
// phone width re-renders this route and redirects a multi view already on
// screen. Like every RedirectWithSearch this drops the hash, and a multi share
// payload that did reach Single would be refused by consumeShareState's mode
// check, so Single opens on its own defaults either way.
function MultiRoute() {
  const isPhone = usePhoneViewport();
  const { demoId } = useParams();
  if (isPhone) {
    return <RedirectWithSearch to={`/${phoneFallbackDemoMode}/${demoId}`} />;
  }
  return <DemoModeRoute Component={DemoMulti} />;
}

function RandomRoute() {
  const params = useParams();
  const demoNavigate = useDemoNavigate();
  const demoId = params.demoId!;
  const nav = useDemoNavigation(demoId);
  useClearShareHash();
  if (demoObjectMap[demoId] === undefined) {
    return <div className="mochart-demo-message"><div className="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.noDemo(demoId)}</div></div>;
  }
  const randomId = Number(params.randomId);
  if (!(randomId > Number.MIN_SAFE_INTEGER && randomId < Number.MAX_SAFE_INTEGER)) {
    return <div className="mochart-demo-message"><div className="demo-alert demo-alert-error" role="alert">{demoText.routeErrors.badRandomId(params.randomId!)}</div></div>;
  }
  const incrementRandomId = () => {
    demoNavigate(`/random/${demoId}/${Math.floor(randomId) + 1}`);
  };
  const decrementRandomId = () => {
    demoNavigate(`/random/${demoId}/${Math.floor(randomId) - 1}`);
  };
  return <DemoRandom demoData={demoData} initialDemoId={demoId} siteRootUrl={siteRootUrl}
    onModeChanged={nav.onModeChanged} onBackToDemos={nav.onBackToDemos}
    randomId={randomId} incrementRandomId={incrementRandomId} decrementRandomId={decrementRandomId} />;
}

function TransitionRoute() {
  const onBackToDemos = useBackToDemos();
  return <DemoTransition siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos} />;
}

function RotationRoute() {
  const onBackToDemos = useBackToDemos();
  return <DemoRotation siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos} />;
}

function SparklineRoute() {
  const onBackToDemos = useBackToDemos();
  return <DemoSparkline siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos} />;
}

// The legacy scheme used a 'demos' pseudo-demo-id for the in-view demo list
// ("/single/demos"), so those URLs redirect to the gallery landing route.
function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/demos" element={<GalleryRoute />} />
      <Route path="/single" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/multi" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/random" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/single/demos" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/multi/demos" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/random/demos" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/random/demos/:randomId" element={<RedirectWithSearch to="/demos" />} />
      <Route path="/single/:demoId" element={<DemoModeRoute Component={DemoSingle} />} />
      <Route path="/multi/:demoId" element={<MultiRoute />} />
      <Route path="/random/:demoId" element={<RandomRedirect />} />
      <Route path="/random/:demoId/:randomId" element={<RandomRoute />} />
      <Route path="/transition" element={<TransitionRoute />} />
      <Route path="/rotation" element={<RotationRoute />} />
      <Route path="/sparkline" element={<SparklineRoute />} />
      <Route path="*" element={<RouteNotFound />} />
    </Routes>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('demo root element (#root) not found');
}

createRoot(rootElement).render(
  <BrowserRouter basename={routerBasePath}>
    <App />
  </BrowserRouter>
);
