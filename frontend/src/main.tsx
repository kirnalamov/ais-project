import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme as antdTheme } from 'antd'
import App from './App'
import 'antd/dist/reset.css'
import './global.css'

const root = createRoot(document.getElementById('root')!)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 0
    }
  }
})
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: antdTheme.darkAlgorithm,
          token: {
            colorPrimary: '#00b96f',
            colorBgBase: '#0b0f15',
            colorBgContainer: 'rgba(18,22,31,0.92)',
            colorBgElevated: '#131926',
            colorBorder: '#283244',
            colorText: '#eef2f8',
            colorTextSecondary: '#9aa8bf',
            borderRadius: 10
          },
          components: {
            Card: {
              borderRadiusLG: 12,
              colorBgContainer: 'rgba(18,22,31,0.92)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)'
            },
            Layout: {
              bodyBg: 'transparent',
              headerBg: '#0e1420'
            },
            Menu: {
              itemSelectedBg: 'rgba(0, 185, 111, 0.16)',
              itemSelectedColor: '#e9fff6'
            }
          }
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
)



