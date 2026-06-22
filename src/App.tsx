import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Menu from './routes/Menu/Menu'
import AppScreen from './routes/AppScreen/AppScreen'
import PWABadge from './PWABadge'
import './App.css'

const router = createBrowserRouter([
  { path: '/', element: <Menu /> },
  { path: '/app/:id', element: <AppScreen /> },
])

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <PWABadge />
    </>
  )
}

export default App
