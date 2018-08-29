import React, {
    Component,
    PropTypes
} from 'react';

import {
    MapView,
    MapTypes,
    Geolocation,
    GetMeasure,
    GetCenterPoint
} from 'react-native-baidu-map';

import {
    Text,
    Image,
    TextInput,
    Button,
    StyleSheet,
    View,
    NativeModules,
    DeviceEventEmitter,
    Modal,
    TouchableOpacity,AsyncStorage
} from 'react-native';

import Dimensions from 'Dimensions';
import Toast from 'react-native-root-toast';
import Storage from './asyncstorage';

export default class BaiduMapDemo extends Component {


    polylineData = [];    //画线数组
    polygonData = [];      //保存单个多边形的数组
    polygonsData = [];      //保存多个多边形的数组
    polygonsText = [];      //面积信息数组
    distanceData = [];   //距离数组

    constructor() {
        super();

        this.state = {
            mayType: MapTypes.NORMAL,
            zoom: 19,
            zoomGestures: true,
            trafficEnabled: false,//交通图
            baiduHeatMapEnabled: false,//热力图
            drawType:null,      //画线类型 是画polyline 还是 polygon
            drawing:false,      //当前画线状态
            polyline:null,
            polygon:null,
            position:false,
            polygons:[],
            searchInfo:false,



            //modal
            isVisible:false
         };
    }
    componentWillMount(){
        Geolocation.getCurrentPosition()
            .then(data => {
                this.setState({
                    marker: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        title: 'Your location',
                        iconType:"gcoding",
                        rotate:0
                    },
                    center: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        rand: Math.random()
                    },
                    markers: [{
                        latitude: data.latitude,
                        longitude: data.longitude,
                        title: "当前位置",
                        iconType:"gcoding",
                        rotate:0

                    }],
                });
            })
            .catch(e =>{
                console.warn(e, 'error');
            })
    }
    componentDidMount() {
        this.walkEmitter=DeviceEventEmitter.addListener("onPositionFollowing",response =>{
            let coordinate = {
                latitude:response.latitude,
                longitude:response.longitude
            };
            this.setState({
                marker: {
                    latitude: parseFloat(response.latitude),
                    longitude: parseFloat(response.longitude),
                    title: 'Your location',
                    iconType:"arrow",
                    rotate:360-parseFloat(response.direction),//方向传感器获得的方向是顺时针的，百度定位需要的方向是逆时针的
                },
                center: {
                    latitude: parseFloat(response.latitude),
                    longitude: parseFloat(response.longitude),
                    rand: Math.random()
                },
            },()=>{
                this.polylineData = this.polylineData.concat(coordinate);
                this.setState({
                    polyline:{
                        points:this.polylineData
                    }
                });
                }
            );
        })
    }
    componentWillUnmount(){
        this.walkEmitter.remove();
    }
    // 计算距离所需要的数据
    makeDistanceData(e){
        this.polylineData = this.polylineData.concat(e);
        if (this.polylineData.length >= 2) {
            var index = this.polylineData.length;
            GetMeasure.getPolylineDistance(
                this.polylineData[index - 2].latitude,
                this.polylineData[index - 2].longitude,
                this.polylineData[index - 1].latitude,
                this.polylineData[index - 1].longitude
            ) .then((data) => {
                var distance = data.distance.toFixed(2);
                e["title"]=JSON.stringify(distance);
                this.setState({
                    polyline:{
                        points:this.polylineData,
                        remove:false
                    }
                });
                this.distanceData = this.distanceData.concat(e);
                this.setState({
                    text:this.distanceData
                });
            }).catch(e => {
                console.warn(e, 'error');
            })
        }
    }

    //计算面积所需要的数据
    setPolygon(e){
        this.distanceData = [];
        this.polylineData = this.polylineData.concat(e);
        this.polygonData = this.polygonData.concat(e);
        if(this.polygonData.length === 2 ){
            this.setState({
                polyline:{
                    points:this.polylineData,
                    remove:false
                },
            });
        }else if (this.polygonData.length >= 3){
            let centerPoint = {};
            GetCenterPoint.getCenterPoint(this.polygonData).then((data) =>{
                let latitude = (data.centerPoint.substring(
                                    data.centerPoint.indexOf(":")+2,
                                    data.centerPoint.indexOf(",")
                                ))*1;
                centerPoint["latitude"]= latitude;
                let longitude = (data.centerPoint.substring(
                                    data.centerPoint.lastIndexOf(":")+2,
                                    data.centerPoint.length
                                ))*1;
                centerPoint["longitude"]= longitude;
                GetCenterPoint.getAcreage(this.polygonData).then((data) =>{
                    centerPoint["title"] = data.getAcreage;
                    this.distanceData = this.distanceData.concat(centerPoint);
                    this.polylineData = [];
                    this.setState({
                        text:this.distanceData,
                        polyline:{
                            points:this.polylineData,
                        },
                        polygon: {
                            points: this.polygonData
                        },
                    });

                });
            })
            .catch(e => {
                console.warn(e, 'error');
            });
        }
    };

    //步行追踪
    positionFollowing() {
        if (this.state.position){
            NativeModules.BaiduLocationObserver.stopObserving();
        }else {
            if (this.isExistOverlay()){
                NativeModules.BaiduLocationObserver.startObserving();
            }else {
                this.setState({
                    position:false
                })
            }
        }
    }
    //重置数组
    resetData(){
        this.polylineData = [];
        this.polygonData = [];
        this.polygonsData = [];
        this.polygonsText = [];
        this.distanceData = [];
        this.setState({
            position:false,
            polyline:this.polylineData,
            polygon:this.polygonData,
            text:this.distanceData,
            polygons:this.polygonsData,
            texts:this.polygonsText,
            searchInfo:false
    })
    }

    //判断当前界面中是否存在覆盖物
    isExistOverlay(){
        if (this.polylineData.length === 0 && this.polygonData.length === 0 && this.distanceData.length === 0){
            return true;
        }else {
            Toast.show("请先重置当前覆盖物再切换功能",{
                duration: Toast.durations.SHORT,
                position: Toast.positions.BOTTOM,
                shadow: true,
                animation: true,
                hideOnPress: true,
                delay: 0,
            });
            return false;
        }
    }

    //获取TextInput的内容
    OwnerData="";
    getOwnerInput(event){
        console.log(event);
        this.OwnerData = event;
    }
    PurposeData="";
    getPurposeInput(event){
        this.PurposeData = event;
    }
    //保存信息
    saveInfo(){
        let saveInfo = {
            points: this.polygonData,
            area: this.distanceData[0].title,
            owner:this.OwnerData,
            purpose: this.PurposeData
        };
        let allKeys=[];
        AsyncStorage.getAllKeys((err,keys)=>{
            if (err) {
                return;
            }
            allKeys = keys;
        }).then(()=>{
            for(let i=0; i<allKeys.length; i++){
                if(this.OwnerData === allKeys[i]){
                    this.OwnerData = this.OwnerData+"_副本";
                    Toast.show("当前所有人重复，已为您更名为:"+this.OwnerData)
                    saveInfo.owner=this.OwnerData;
                }
            }
            Storage.save(this.OwnerData,saveInfo);
            //添加数组信息到polygons
            this.polygonsData = this.polygonsData.concat(this.state.polygon);
            this.polygonData = [];
            var index = this.distanceData.length;
            var info=[
                {
                latitude:this.distanceData[index-1].latitude,
                    longitude:this.distanceData[index-1].longitude,
                    title:this.distanceData[index-1].title + this.OwnerData + this.PurposeData
            }
        ];

            this.polygonsText = this.polygonsText.concat(info);
            this.setState({
                polygon:this.polygonData,
                polygons:this.polygonsData,
                texts:this.polygonsText
            });
            this.distanceData = [];

        });
        }

    //获取搜索框的内容
    SearchData="";
    getSearchText(event){
        this.SearchData = event;
    }
    //获取保存的信息
    getSaveInfo(key){
        if(this.isExistOverlay()){
            Storage.get(key).then((event)=>{
                if(event === null){
                    Toast.show("当前所有人不存在土地");
                    return;
                }
                let centerPoint = {};
                GetCenterPoint.getCenterPoint(event.points).then((data) =>{
                    let latitude = (data.centerPoint.substring(
                        data.centerPoint.indexOf(":")+2,
                        data.centerPoint.indexOf(",")
                    ))*1;
                    centerPoint["latitude"]= latitude;
                    let longitude = (data.centerPoint.substring(
                        data.centerPoint.lastIndexOf(":")+2,
                        data.centerPoint.length
                    ))*1;
                    centerPoint["longitude"]= longitude;
                    centerPoint["title"] = event.area + event.owner + event.purpose;
                    this.distanceData = this.distanceData.concat(centerPoint);
                    let points = [{
                        points:event.points
                    }];
                    this.polygonData = this.polygonData.concat(points);
                    this.setState({
                        polygons: this.polygonData,
                        text:this.distanceData,
                        searchInfo:true
                    });
                })
                    .catch(e => {
                        console.warn(e, 'error');
                    });
            });
        }

    }

    deleteSaveInfo(key){
        Storage.delete(key);
        this.resetData();
    }

    render() {
        return (
            <View style={styles.container}>
                <MapView
                    trafficEnabled={this.state.trafficEnabled}
                    baiduHeatMapEnabled={this.state.baiduHeatMapEnabled}
                    zoom={this.state.zoom}
                    zoomGestures={this.state.zoomGestures}
                    mapType={this.state.mapType}
                    center={this.state.center}
                    marker={this.state.marker}
                    markers={this.state.markers}
                    text={this.state.text}
                    texts={this.state.texts}
                    polyline={this.polylineData.length>=2?this.state.polyline:null}
                    polygon={this.polygonData.length>=3?this.state.polygon:null}
                    polygons={this.state.polygons}
                    style={styles.map}
                    onMarkerClick={(e) => {
                    }}
                    onMapClick={(e) => {
                        if (this.state.drawing){
                            if(this.state.drawType === "distance"){
                                this.makeDistanceData(e);
                            }else if(this.state.drawType === "area"){
                                this.setPolygon(e);
                            }
                        }
                    }}
                    onMapPoiClick={(e) =>{
                        if (this.state.drawing){
                            if(this.state.drawType === "distance"){
                                this.makeDistanceData(e);
                            }else if(this.state.drawType === "area"){
                                this.setPolygon(e)
                            }
                        }
                    }}
                    onMapDoubleClick={() => {
                        this.setState(
                            {
                                drawing:false
                            }
                        );
                    }}
                >
                </MapView>
                <View style={styles.search}>
                    <TextInput style={styles.search_input} onChangeText={
                        (event)=>{
                            this.getSearchText(event);
                        }
                    }/>
                    <Button style={styles.search_btn} title="搜索" onPress={()=>{
                        this.getSaveInfo(this.SearchData);
                    }}/>
                </View>
                <View style={styles.mapType}>
                    <TouchableOpacity onPress={() => this.setState({mapType: MapTypes.NORMAL})}>
                        <Image source={require("../images/normal.png")} style={styles.mapTypeImg}/>
                        <Text style={styles.mapTypeText}>普通图</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => this.setState({mapType: MapTypes.SATELLITE})}>
                        <Image source={require("../images/satellite.png")} style={styles.mapTypeImg}/>
                        <Text style={styles.mapTypeText}>卫星图</Text>
                    </TouchableOpacity>
                </View>
                <Modal
                    animationType='slide'
                    transparent = {false}
                    visible = {this.state.isVisible}
                    onRequestClose = {()=>{
                        this.onRequestClose()
                    }}>
                    <View>
                        <Text>所有人</Text><TextInput onChangeText={
                            (event)=>{
                            this.getOwnerInput(event)
                    }}/>
                        <Text>当前用途</Text><TextInput onChangeText={
                            (event) =>{
                            this.getPurposeInput(event)
                    }}/>
                        <Button title="确认" onPress={() => {
                            this.setState({
                                    isVisible:false
                                }
                            );
                            this.saveInfo();
                        }}/>
                    </View>
                </Modal>
                <View style={styles.row}>
                    <Button title="距离测量" disabled={this.state.drawType === "" || this.state.drawType === "distance"} onPress={() => {
                        if (this.isExistOverlay()){
                            this.setState(
                                {
                                    drawing:true,
                                    drawType:"distance",
                                    zoomGestures: false
                                }
                            );
                        }
                    }} />

                    <Button title="面积测量" disabled={this.state.drawType === "" || this.state.drawType === "area"} onPress={() => {
                        if (this.isExistOverlay()) {
                            this.setState({
                                drawing: true,
                                drawType: "area",
                                zoomGestures: false
                            })
                        }
                    }} />

                    <Button title={this.state.position?"停止追踪":"步行追踪"} disabled={this.state.drawType === "" || this.state.drawType === "postionFollowing"}
                            onPress={() => {
                                if(this.isExistOverlay()){
                                    this.setState({
                                        drawing: true,
                                        drawType: "postionFollowing",
                                        zoomGestures: false,
                                        startFollowing:true
                                    });
                                    this.positionFollowing();
                                }
                            }} />
                    <Button title="重置" disabled={!this.state.drawType === "null"} onPress={() => {
                        this.resetData();
                        this.setState(
                            {
                                drawType:null,
                                zoomGestures: true,

                                polyline:{
                                    points:this.polylineData,
                                },
                                text:this.distanceData,
                                polygon:{
                                    points:this.polylineData,
                                },
                            }
                        );
                    }} />

                    <Button title={this.state.searchInfo?"删除":"保存"} onPress={ () =>{
                        if(this.state.searchInfo){
                            this.deleteSaveInfo(this.SearchData)
                            this.setState({
                                searchInfo:false
                            });
                        }else{
                            if(this.state.drawType ==="area"){
                                this.setState({
                                        isVisible:true
                                    }
                                )
                            }
                        }
                    }}/>
                </View>
            </View>
        );
    }

}

const styles = StyleSheet.create({
    row: {
        position: 'absolute',
        flexDirection: 'row',
        justifyContent: 'center',
        bottom: 30,
        width: Dimensions.get('window').width,
    },
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        marginBottom: 16
    },
    search:{
        position: 'absolute',
        flexDirection: 'row',
        marginTop:20,
        backgroundColor:'#ffffff',
        height: Dimensions.get('window').height * 0.05,
    },
    search_input:{
        width:Dimensions.get('window').width * 0.8,
        height: Dimensions.get('window').height * 0.05,
    },
    search_btn:{
        // width: Dimensions.get('window').width * 0.2,
        height: Dimensions.get('window').height * 0.05,
    },
    // modal_text:{
    //     width:Dimensions.get('window').width*0.2,
    // },
    // modal_textInput:{
    //     width:Dimensions.get('window').width*0.8,
    // },
    mapType: {
        position: 'absolute',
        flexDirection: 'column',
        justifyContent: 'center',
        top: 80,
        right: 10,
    },
    mapTypeText: {
        top: -18,
        fontSize: 12,
        color: "#fff"
    },
    mapTypeImg: {
        height: Dimensions.get('window').height * 0.05,
        width: Dimensions.get('window').width * 0.1,
    },
});
