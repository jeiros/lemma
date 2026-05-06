import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import App from './App';
import Capture from './routes/Capture';
import Review from './routes/Review';
import List from './routes/List';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/capture" replace /> },
      { path: 'capture', element: <Capture /> },
      { path: 'review', element: <Review /> },
      { path: 'list', element: <List /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
