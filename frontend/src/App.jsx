import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Landing from './pages/Landing'
import getCurrentUser from './features/getCurrentUser'
import { useDispatch, useSelector } from 'react-redux'
import { setUserdata } from './redux/userSlice'

function App() {

const dispatch=useDispatch()
const {userData}=useSelector(state=>state.user)
const [showApp,setShowApp]=useState(()=>window.location.hash === '#app')

useEffect(()=>{
  const getUser=async ()=>{
    const data=await getCurrentUser()
    dispatch(setUserdata(data))
  }
  getUser()
},[dispatch])

useEffect(()=>{
  const syncView=()=>setShowApp(window.location.hash === '#app')
  window.addEventListener('hashchange',syncView)
  return ()=>window.removeEventListener('hashchange',syncView)
},[])

const openApp=()=>{window.location.hash='app'}
const openHome=()=>{window.location.hash='top'}

  return (
   <>
   {showApp
     ? <Home onHome={openHome}/>
     : <Landing onLaunch={openApp} isLoggedIn={!!userData}/>}
   </>
  )
}

export default App
