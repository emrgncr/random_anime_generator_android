import React, { useState } from 'react';
import { StyleSheet, Text, View,Button,ScrollView,Image,Linking,ActivityIndicator ,RefreshControl,FlatList, Switch} from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Slider } from '@miblanchard/react-native-slider';
import { tags } from './tags';
import { StatusBar } from 'expo-status-bar';

const MAX = 21000/50;
var cache = {};
var prev = [];

var blacklist = [];
var whitelist = [];
var on_start = false;
var showSavedTab = null;

const saveAnime  = ({anime_name,anime_link,anime_img},wb,setSaved,getSaved)=>{
  let saved = getSaved.slice();
  //return if saved contains object with same anime_name
  for(let i in saved){
    if(saved[i].anime_name == anime_name){
      return;
    }
  }
  saved.push({anime_name:anime_name,anime_link:anime_link,anime_img:anime_img})
  if(wb){
    setSaved(saved)
    AsyncStorage.setItem('saved_a',JSON.stringify(saved))}
  else{
    setSaved(saved)
    AsyncStorage.setItem('saved_b',JSON.stringify(saved))}
  
}

const removeSavedAnime = (anime_name,wb,setSaved,getSaved)=>{
  let saved = getSaved;
  let new_saved = []
  for(let i in saved){
    if(saved[i].anime_name != anime_name){
      new_saved.push(saved[i])
    }
  }
  if(wb){
  setSaved(new_saved)
  AsyncStorage.setItem('saved_a',JSON.stringify(new_saved))}
  else{
  setSaved(new_saved)
  AsyncStorage.setItem('saved_b',JSON.stringify(new_saved))}
}


function escapeHTML(str=""){
  let i1 = str.indexOf('<')
  let i2 = 0;
  while(i1 != -1 && i2 != -1){
    i2 = str.indexOf('>',i1);
    str = str.substring(0,i1) + str.substring(i2+1,str.length)
    i1 = str.indexOf('<')
  }
  return escape_convert(str);
}

function escape_convert(text:String){
  text = text.replace(/&quot;/g, "&#34;")
  text = text.replace(/&nbsp;/g, "&#160;")
  text = text.replace(/&apos;/g, "&#139;")
  text = text.replace(/&amp;/g, "&#38;")
  text = text.replace(/&lt;/g, "&#60;")
  text = text.replace(/&gt;/g, "&#62;")
  text = text.replace(/&mdash;/g, "&#8212;")
  let i = text.indexOf("&#")
  let i2 = 0
  while(i != -1 && i2 != -1){
    i2 = text.indexOf(';',i);
    if(i2 == -1) break;
    text = text.substring(0,i) + String.fromCharCode(Number(text.substring(i+2,i2))) + text.substring(i2+1,text.length)
    i = text.indexOf("&#")
  }
  return text
}

const getTags = (text:String) => {
  let i1 = 0
  let i2 = 0
  let ret = []
  let texts = ['Genres:','Themes:','Demographic:','Genre:','Theme:','Demographics:']
  for(let j in texts){
    i1 = 0
    i2 = 0
    let q = texts[j]
    i1 = text.indexOf(q)
    if(i1 != -1){
      i1 += q.length
      i2 = text.indexOf('\n',i1+2)
      let gnres = text.substring(i1,i2).split(',')
      for(let i in gnres){
        gnres[i] = gnres[i].trim();
      }
      ret = ret.concat(gnres)
    }
  }
  //console.log(ret)
  return ret
}

const parseSecondHtml = (text = "") => {
  let i1 = text.indexOf("itemprop=\"description\"") - 3; 
  let i2 = text.indexOf("</p><div style=\"m",i1) + 4;
  // //console.log(text.substring(i1,i2))
  let synopsis = escapeHTML(text.substring(i1,i2)) 

  i1 = text.indexOf("score-label")
  i1 = text.indexOf(">",i1) + 1
  i2 = text.indexOf("<",i1)
  let score = text.substring(i1,i2)


  i1 = text.indexOf("og:title") + 19;
  i2 = text.indexOf(">",i1) -1;
  let name = escapeHTML(text.substring(i1,i2))


  i1 = text.indexOf("<h2>Information</h2>")
  i2 = text.indexOf("<h2>Statistics</h2>", i1)
  i1 += 22
  let i3 = text.indexOf("<span itemprop=",i1);
  while(i3 < i2 && i3 != -1){
    let i4 = text.indexOf(">",i3+1)
    text = text.substring(0,i4) +  ' ' +text.substring(i4 + 1,text.length)
    i4 = text.indexOf('<',i4 + 1)
    text = text.substring(0,i4) +  ' ' +text.substring(i4 + 1,text.length)
    i3 = text.indexOf("<span itemprop=",i3+1);
  }



  let info = escapeHTML(text.substring(i1,i2))
  info = info.replace(/  +/g,' ')
  let inf = info.split('\n')
  for(let i = 0;i<inf.length;i++){
    inf[i] = inf[i].trim();
  }
  info = inf.join('\n')
  info = info.replace(/\n\n+/g, '\n\n')
  // //console.log(info)
  
  return {
    anime_info: info,
    synopsis: synopsis,
    anime_name: name,
    score: score,
    tags: getTags(info)
  }

}

const parseMainHtml = (text="",ind = 0,movies_included = false) => {
  let i1 = 0
  let i2 = 0
  for(let i = 0;i<=ind;i++){
    i1 = text.indexOf("title al va-t word-break",i1+1);
    if(i1 == -1) return false;
  }

  i1 = text.indexOf('images/anime/',i1);
  i2 = text.indexOf('.',i1);
  let imgpart = text.substring(i1,i2);
  let imgurl = `https://cdn.myanimelist.net/${imgpart}.jpg`
  //console.log(imgurl)

  i1 = text.indexOf("a href=",i1);
  if(i1 == -1) return false;
  i1 += 8;
  i2 = text.indexOf('"',i1+1);
  let anime_url = text.substring(i1,i2);
  //console.log(anime_url)


  i1 = text.indexOf("information di-ib mt4",i1);
  if(i1 == -1) return false;
  i1 += 24;
  i2 = text.indexOf("<br>",i1)
  let genre = text.substring(i1,i2).trim()
  //console.log(genre)
  if(! genre.startsWith('TV')  && (!genre.startsWith('Movie') && movies_included)) return false;
  //TODO do smt
  //if satisfied until this point, get synopsis, genres
  return {
    image_url: imgurl,
    anime_url: anime_url
  }

}
const parseMainHtmlWrapper = (text = "",ind = 0, skip = false,blist = [],movies_included) => {
  if(!skip){
    while(ind < 50){
      let rt = parseMainHtml(text,ind,movies_included);
      for(let i in blist){
        if(blist[i].anime_link == rt.anime_url){
          console.log('skipping ' + rt.anime_url)
          rt = false
          break;
        }
      }
      if( rt !== false) return rt;
      ind++;
    }
    return false;
  }
  else{
    return parseMainHtml(text,ind,movies_included);
  }
}







function HomeScreen(props) {
  const [getAnimeInfo,setAnimeInfo] = useState({});
  const [isLoading,setLoading] = useState(true);
  const [isRefreshing,setRefreshing] = useState(false);
  
  
  const constructBlist = ()=>{
    let blist = []
    let cache1 = props.getSaved
    let cache2 = props.getSavedb
    for(let i in cache1){
      blist.push(cache1[i])
    }
    for(let i in cache2){
      //exclude if already in blist
      let found = false;
      for(let j in blist){
        if(blist[j].anime_link == cache2[i].anime_link){
          found = true;
          break;
        }
      }
      if(!found) blist.push(cache2[i])
    }
    return blist;
  }

  const getRandomAnime = async (blist = undefined, num = undefined, skip = false,loadAnim = true) => {
    //try the cache
    //if blist is undefined construct it
    if(blist == undefined){
      blist = constructBlist()
    }
    // console.log(blist)
    
    if(loadAnim){
      setLoading(true);
    }

    let randnum = Math.floor(Math.random() * props.getRandmax);
    let randsel = Math.floor(Math.random() * 50);
    let page = randnum * 50
    if(num != undefined){
      randsel = num % 50;
      randnum = Math.floor(num / 50)
    }
    try{
      const res = await fetch(`https://myanimelist.net/topanime.php?limit=${page}`)
      //check if 404
      let text = await res.text();
      if(text.includes("404 Not Found - MyAnimeList.net")){
        //console.log("404 error")
        await getRandomAnime(blist)
      }else{
        let rt = parseMainHtmlWrapper(text,randsel,skip,blist,props.isIncludingMovies)
        if(rt !== false){
          let anime_url = rt.anime_url;
          let image_url = rt.image_url;
          
          let ret2 = await fetch(anime_url);
          let text2 = await ret2.text();
          let {anime_info,synopsis,anime_name,score,tags} = parseSecondHtml(text2)
          //console.log(anime_name)
          //check blacklist
          for(let b in blacklist){
            if(tags.includes(blacklist[b])){
              //console.log('blacklisted')
              await getRandomAnime(blist);
              return;
            }
          }
          for(let w in whitelist){
            if(!tags.includes(whitelist[w])){
              //console.log('whitelist blocked')
              await getRandomAnime(blist);
              return;
            }
          }


          // //console.log(anime_name + '\n\n\n' + synopsis + '\n\n\n' + anime_info)
          
          prev.push(getAnimeInfo)
          if(prev.length > 20){
            prev = prev.slice(10,prev.length)
          }
          setAnimeInfo({anime_info,synopsis,anime_name,image_url,score,anime_url,tags})
          setLoading(false)
          if(isRefreshing){
            setRefreshing(false);
          }
  
        }else{
          //console.log("Nope");
          await getRandomAnime(blist);
        }
      }
  
    }catch(e){
      console.error(e)
    }
  }
  // //console.log(getAnimeInfo.)
  if(getAnimeInfo.anime_name == undefined)
    getRandomAnime(undefined,undefined,false,false)
  return (
    <View style={{ flex: 1, justifyContent: 'center',flexDirection: 'column',marginHorizontal:6,alignItems:'center'}}>
      <View style= {{flex:6, /*backgroundColor:'red', */alignSelf:'stretch',marginVertical:4,justifyContent: 'center'}}>
      {isLoading && <ActivityIndicator
               animating = {isLoading}
               color = '#bc2b78'
               size = "large"
               style = {{}}/>}
        {!isLoading && <ScrollView style={{/*backgroundColor:'blue'*/backgroundColor:'#0F0F0F',borderRadius:6}}
                                    refreshControl={<RefreshControl
                                                  onRefresh={()=>{setRefreshing(true);getRandomAnime([],undefined,false,false).then(()=>{
                                                    setRefreshing(false);
                                                  });}}
                                                  refreshing={isRefreshing}
                                    />}>
        <Text style= {{textAlign: 'center', fontSize:24, fontWeight:'bold',color:'snow'}}>{getAnimeInfo.anime_name}</Text>
        <Text style= {{textAlign: 'center', fontSize:24, fontWeight:'bold',color:'snow'}}>MAL Score: {getAnimeInfo.score}/10</Text>
        <Image
        style={{width:'60%',aspectRatio:225/330,alignSelf:'center',marginVertical:4}}
        source = {{uri: getAnimeInfo.image_url}}
        borderRadius={4}
        />
        <Text style={{marginHorizontal:4,fontSize:18,color:'snow',marginVertical:5,textAlign:'center'}}>{getAnimeInfo.tags.join(', ')}</Text>
        <Text style={{marginHorizontal:4,fontSize:16,color:'snow',marginVertical:4}}>{getAnimeInfo.synopsis}</Text>
        <Text style={{marginHorizontal:4,fontSize:16,color:'snow',marginVertical:4}}>{'\n' + getAnimeInfo.anime_info}</Text>
        </ScrollView>}
      </View>
      <View style={{flex:2.2, alignSelf:'stretch',justifyContent:'space-evenly',marginHorizontal:12}}>
      <Button
        title="Random"
        onPress= {() => getRandomAnime()}
      />
      <Button
        title="Go to MAL page"
        onPress= {() => Linking.openURL(getAnimeInfo.anime_url)}
      />
      <Button
        title="Previous"
        onPress= {() => setAnimeInfo(prev.pop())}
      />
      <View style={{flexDirection:'row', width:'100%', justifyContent:'space-between'}}>
        <View style={{width:'48%'}}>
      <Button
        title="Blacklist"
        onPress={()=>{saveAnime({anime_name:getAnimeInfo.anime_name,
                                anime_link:getAnimeInfo.anime_url,
                                anime_img:getAnimeInfo.image_url},
                                true,props.setSavedb,props.getSavedb)}}
      />
      </View>
      <View style={{width:'48%'}}>
      <Button
        title="Save"
        onPress={()=>{saveAnime({anime_name:getAnimeInfo.anime_name,
                                anime_link:getAnimeInfo.anime_url,
                                anime_img:getAnimeInfo.image_url},
                                true,props.setSaved,props.getSaved)}}
      />
      </View>
      </View>
      </View>
    </View>
  );
}

function arrayRemove(arr, value) { 
  return arr.filter(function(ele){ 
      return ele != value; 
  });
}

const SelectTag = ({title, update}) => {
  const [getClicked,setClicked] = useState(0);
  // let isClicked = false;
  const ts = this;

  return (
  <View style={{ flex: 1, justifyContent: 'center',flexDirection: 'column',marginHorizontal:6,marginVertical:4,alignItems:'stretch'}}>
    <Button
      title={title}
      onPress={() => {
        if(getClicked == 2)
          setClicked(0)
        else
          setClicked(getClicked + 1)
        if(getClicked == 0){
          blacklist.push(title)
          update(false)
        }else{
          blacklist = arrayRemove(blacklist,title)
          update(false)
        }
        if(getClicked == 1){
          whitelist.push(title)
          update(true)
        }else{
          whitelist = arrayRemove(whitelist,title)
          update(true)
        }
        //console.log('blacklist + ' + blacklist)
        //console.log('whitelist + ' + whitelist)
      }}
      color={getClicked == 0 ? 'gray' : getClicked == 1 ? 'red' : 'blue'}
    />
  </View>
  )
}

const ShowSaved = ({anime_name,anime_link,anime_img,setSaved,getSaved}) => {
  // console.log(anime_name + anime_link + anime_img)
  return (
    <View style={{ flex: 1, justifyContent: 'center',flexDirection: 'column',marginHorizontal:6,marginVertical:20,alignItems:'stretch',backgroundColor:'#1F1F1F',borderRadius:8}}>
    <View style={{justifyContent: 'space-around',flexDirection: 'row',marginHorizontal:6,marginVertical:4,alignItems:'center'}}>
      <Text style= {{textAlign: 'left',textAlignVertical:'center' ,fontSize:18, fontWeight:'bold',color:'snow',marginHorizontal:4,width:'80%'}}>{anime_name}</Text>
      <Image
      style={{width:'20%',aspectRatio:225/330,alignSelf:'center',marginHorizontal:4}}
      source = {{uri: anime_img}}
      borderRadius={4}
      />
    </View>
    <View style={{marginHorizontal:8,marginVertical:8}}>
    <View style={{marginVertical:4}}>
    <Button
      title='Go to MAL page'
      onPress= {() => Linking.openURL(anime_link)}
    />
    </View>
    <View style={{marginVertical:4}}>
    <Button
      title='Remove'
      onPress={()=>{removeSavedAnime(anime_name,true,setSaved,getSaved)}}
    />
    </View>
    </View>
    </View>
  )
}


class ShowASaved extends React.Component {
  render(){
    const renderItem = ({ item }) => (
      <ShowSaved anime_name={item.anime_name} anime_link={item.anime_link} anime_img={item.anime_img} setSaved={this.props.setSaved} getSaved={this.props.getSaved}/>
    );
  return(
    <View style={{ flex: 1, justifyContent: 'center',flexDirection: 'column',marginHorizontal:6,alignItems:'stretch',backgroundColor:'black'}}>
      <FlatList
        data={this.props.getSaved}
        renderItem={renderItem}
        keyExtractor={item => item.anime_name}
        style={{backgroundColor:'black',borderRadius:6}}
      />
    </View>
  )
  }
}




function SettingsScreen(props) {
  const [getBlacklist, setBlacklist] = useState([])
  const [getWhitelist, setWhitelist] = useState([])
  const update = (white:Boolean) => {
    if(white){
      setWhitelist(whitelist)
    }else{
      setBlacklist(blacklist)
    }
  } 

  // if(isUpdating){
  //   setUpdating(false)
  // }

  const renderItem = ({ item }) => (
    <SelectTag title={item.title} update={update}/>
  );
  // const buttonsForceUpdate = () => {
  //   this.forceUpdate();
  // }

  return (
    <View style={{ flex: 1, justifyContent: 'center',flexDirection: 'column',marginHorizontal:6,alignItems:'stretch',marginVertical:6}}>
      <View style= {{alignItems:'stretch',flex: 1,justifyContent: 'center',marginHorizontal:12,}}>
      <Text style= {{textAlign: 'center', fontSize:16, fontWeight:'bold',color:'snow'}}>Choose from top ? animes: {props.get * 50} / {MAX * 50}</Text>
      <Slider
        value={props.get * 50}
        onValueChange={(value) => {props.set(value/50)}}
        minimumValue={100}
        maximumValue={MAX*50}
        step={50}
    />
    </View>
    <View style= {{alignItems:'center',flex: 1,justifyContent: 'space-evenly',marginHorizontal:12,flexDirection:'row'}}>
    <Text style= {{textAlign: 'center', fontSize:16, fontWeight:'bold',color:'snow'}}>Include movies?</Text>
    <Switch
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={!props.isIncludingMovies ? "#767577" : "#81b0ff"}
        onValueChange={()=>{props.setIncludingMovies(!props.isIncludingMovies)}}
        value={props.isIncludingMovies}
      />
    </View>
    <View style= {{alignItems:'stretch',flex: 8,justifyContent: 'center',marginHorizontal:12}}>
    <Text style= {{textAlign: 'left', fontSize:16, fontWeight:'bold',color:'snow',marginHorizontal:3,marginVertical:3}}>Must have ({<Text style={{fontStyle:'italic'}}>VERY</Text>} slow): {getWhitelist.join(', ')}</Text>
    <Text style= {{textAlign: 'left', fontSize:16, fontWeight:'bold',color:'snow',marginHorizontal:3,marginVertical:3}}>Must NOT have: {getBlacklist.join(', ')}</Text>
    <FlatList
        data={tags}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={{backgroundColor:'#0F0F0F',borderRadius:6}}
      />
      <Button
        title="Clear"
        onPress={() => {
          whitelist = []
          blacklist = []
          update(true)
          update(false)
          // buttonsForceUpdate();
        
        }}
      />
    </View>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [getRandmax,setRandmax] = useState(5000/50)
  const [getSaved,setSaved] = useState([])
  const [getSavedb,setSavedb] = useState([])
  const [isIncludingMovies,setIncludingMovies] = useState(false);
  if(!on_start){
  AsyncStorage.getItem('saved_a').then(res => {
    if(res != null){
      setSaved(JSON.parse(res))
      console.log(res)
    }
  }).catch(err => {
    console.log(err)
  })
  AsyncStorage.getItem('saved_b').then(res => {
    if(res != null){
      setSavedb(JSON.parse(res))
    }
  }).catch(err => {
    console.log(err)
  })
  on_start=true;
}


//   if(Object.keys(cache).length == 0){
//   AsyncStorage.getItem('cache').then((a)=>{
//     a = JSON.parse(a)
//     //console.log(a)
//     if(a != null&& Object.keys(a).length != 0)
//     cache = a
//   })
// }
  return (
    <NavigationContainer theme={DarkTheme}>
      <Tab.Navigator
      screenOptions={tabOptions}
      >
      <Tab.Screen name="Random" children={()=> <HomeScreen getRandmax={getRandmax} setSaved={setSaved} getSaved={getSaved} setSavedb={setSavedb} getSavedb={getSavedb} isIncludingMovies={isIncludingMovies} setIncludingMovies={setIncludingMovies}/>}/>
      <Tab.Screen name="Saved" children={()=> <ShowASaved setSaved={setSaved} getSaved={getSaved} />} />
      <Tab.Screen name="Blacklisted" children={()=> <ShowASaved setSaved={setSavedb} getSaved={getSavedb}/>} />
      <Tab.Screen name="Settings" children={()=> <SettingsScreen get={getRandmax} set={setRandmax} isIncludingMovies={isIncludingMovies} setIncludingMovies={setIncludingMovies}/>} />
      </Tab.Navigator>
      <StatusBar style='white' backgroundColor="#0F0F0F"/>
    </NavigationContainer>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});


const tabOptions = ({route}) => ({
  tabBarIcon: ({ focused, color, size }) =>{
    let iconName;
    if(route.name == 'Random'){
      iconName = focused ? 'shuffle' : 'shuffle-outline'
    }else
    if(route.name == 'Settings'){
      iconName = focused ? 'settings' : 'settings-outline'
    }else
    if(route.name == 'Saved'){
      iconName = focused ? 'bookmark' : 'bookmark-outline'
    }
    if(route.name == 'Blacklisted'){
      iconName = focused ? 'trash' : 'trash-outline'
    }
    return <Ionicons name={iconName} size={size} color={color} />;
  }
})