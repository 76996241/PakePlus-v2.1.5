import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';

class VueAccessorWorker {
  constructor() {
    this.vueInstance = null;
    this.sn = '';
    this.switchStatus = '';
    this.nextSign = '';
    this.initialData = {};
    this.workerData = {
      processedItems: 0,
      lastUpdate: null
    };
    this.commData = {
      SerialNumber:'',
      type:''
    };
    this.oldData = [];
    this.oldNum = 0;
    this.smodeNumVals = [[],[]];
    this.smodeNum = 1;
    this.startNum = 0
  }

  // 注册Vue实例
  async registerVueInstance(vueProxy,sn,switchStatus,nextSign) {
    this.vueInstance = vueProxy;
    this.sn = sn
    this.switchStatus = switchStatus
    this.nextSign = nextSign
    // 测试访问Vue数据
    this.initialData = await this.vueInstance.getData();
    console.log('Worker获取到Vue初始数据:', this.sn);
    this.vueInstance.addConsole(this.sn,this.sn+'-Worker已连接', 'danger')
    await this.vueInstance.showNotification('Worker已连接');
  }

  // 处理数据并更新Vue
  async processData(items) {
    if (!this.vueInstance) {
      throw new Error('Vue实例未注册');
    }
    await this.vueInstance.startConnection(this.sn);
    return false
 /*    // 获取Vue当前状态
    const currentState = await this.vueInstance.getData();
    console.log('当前Vue状态:', currentState);

    // 处理数据
    for (let i = 0; i < items.length; i++) {
      // 模拟耗时处理
      await new Promise(resolve => setTimeout(resolve, 50));

      // 更新Vue进度
      await this.vueInstance.updateProgress({
        current: i + 1,
        total: items.length
      });

      // 更新Worker内部状态
      this.workerData.processedItems++;
      this.workerData.lastUpdate = new Date().toISOString();

      // 定期更新Vue数据
      if (i % 10 === 0) {
        await this.vueInstance.updateResults({
          processed: this.workerData.processedItems,
          lastItem: items[i]
        });
      }
    }

    // 处理完成
    await this.vueInstance.showNotification('数据处理完成');
    return {
      success: true,
      processed: items.length,
      workerState: this.workerData
    }; */
  }

  // 从Vue获取配置
  async getConfigFromVue() {
    if (!this.vueInstance) {
      throw new Error('Vue实例未注册');
    }
    return await this.vueInstance.getConfig();
  }
  /**
   * 回调函数
   * @param arrayData
   * @param pid
   */

  async userCheckProcessCallback(arrayData, pid, reCode) {
    let data = [],dBm,dBmb,dBma,smodeNums
    data.result = 1

    if(arrayData[0]!=='0'){
      if(this.startNum===10){
        this.vueInstance.addConsole(this.sn,'当前无法连接设备，停止运行', 'danger')
        return false
      }
      this.vueInstance.addConsole(this.sn,'当前无法连接设备，等待重新连接', 'danger')
      setTimeout(function() {
        this.vueInstance.startConnection(this.sn);
        this.startNum++
      }.bind(this), 10000*this.startNum)
      return false
    }

   //console.log(arrayData)
    switch (pid) {
      //*********************创建设备练练***********************/
      case '1112'://连接设备
          data['freqDeviceNumber'] = 1113
          data['timeout'] = 0
          this.resultProcessing(data)
          this.vueInstance.addConsole(this.sn,'发送密码校验', 'danger')
        break
/*       case '1114'://连接设备
          data['freqDeviceNumber'] = 1116
          data['timeout'] = 0
          this.resultProcessing(data)
        break */
      case '1116'://获取序列号
        if(arrayData[2] === ''){
          arrayData[2] = this.sn
        }
        if(arrayData[1] === ''){
          arrayData[1] = 'AE8600S'
        }
        this.commData.type = arrayData[1]
        this.commData.SerialNumber = this.commData.type+'_'+arrayData[2]
        this.vueInstance.addConsole(this.sn,this.sn+'序列号'+this.commData.SerialNumber, 'danger')

        data['freqDeviceNumber'] = 1
        data['timeout'] = 0
        this.resultProcessing(data)
        break
      case '2'://关闭自动清零设置结果
        data.timeout = 1
        //返回失败
        if (arrayData[2] !== '0') {
          data.timeout = 0
          data.freqDeviceNumber = 2
        }else{
          this.startNum = 0
          data.freqDeviceNumber= 3
          data.param = this.roundNumber(this.initialData.wavelength, 4) + 'nm'
        }
        this.resultProcessing(data)
        break
      case '4'://设置86400s中心波长
        data.result = 1
        data.freqDeviceNumber= 5
        data.timeout = 0
        dBm = this.roundNumber(parseFloat(arrayData[2])*1000000000, 4)
        //返回失败
        if (this.initialData.wavelength != dBm) {
          data.result= 0
          data.freqDeviceNumber = 4
        }else{
          data.param = 10+'nm'
        }
        this.resultProcessing(data)
        break
      case '6'://SPAN
        data.result = 1
        data.freqDeviceNumber= 7
        data.param = 'MID'
        //返回失败
        if (this.getNm(arrayData[2])  != 10) {
          data.result= 0
          data.freqDeviceNumber = 6
          data.param = ''
        }
        data.timeout = 0
        this.resultProcessing(data)
        break
      case '8'://外灵敏度
        data.result = 1
        data.freqDeviceNumber= 9
        //返回失败
        if (arrayData[2] !== '2') {
          data.result= 0
          data.freqDeviceNumber = 8
        }else{
          data.param =  0.02+'nm'
        }
        data.timeout = 0
        this.resultProcessing(data)
        break
      case '10'://分辨率
        data.result = 1
        data.freqDeviceNumber= 11
        dBm = Number(parseFloat(arrayData[2])*1000000000)
        //返回失败
        if (dBm !== 0.02) {
          data.result= 0
          data.freqDeviceNumber = 10
        }else{
          data.param = '0.001nm'
        }
        data.timeout = 0
        this.resultProcessing(data)
        break
      case '12'://采样点
        data.result = 1
        data.freqDeviceNumber= 13
        dBm = Number(parseFloat(arrayData[2])*1000000000)
        //返回失败
        if (dBm != 0.001) {
          data.result= 0
          data.freqDeviceNumber = 12
        }
        data.timeout = 0
        this.resultProcessing(data)
        break
      case '14'://设置DFB分析
        data.result = 1
        data.freqDeviceNumber = 16
        //返回失败
        if (arrayData[2] !== '1') {
          data.result = 0
          data.freqDeviceNumber = 14
        }
        data.timeout = 0
        this.resultProcessing(data)
        break
      case '18'://单次扫描
        data.result = 1
        data.freqDeviceNumber = 19
        data.timeout = 0
        //返回失败
        if (arrayData[2] !== '1') { //1
          data.result = 0
          data.freqDeviceNumber = 18
          data.timeout = 0
        }
        this.resultProcessing(data)
        break
      case '20'://询问
        //返回失败
        if (arrayData[2] !== '1') {
          data.result = 0
          data.freqDeviceNumber = 20
          data.timeout = 2000
        }else{  //  完成次数后记录值
          data.result = 1
          data.freqDeviceNumber = 21
          data.timeout = 0
        }
        this.resultProcessing(data)
        break
      case '21'://功率
        data.result = 1
        data.timeout = 0
        dBmb =Number(this.roundNumber(parseFloat(arrayData[2]), 3))
        if(dBmb !== 0) {
          this.smodeNumVals[0].push(dBmb)
          data.freqDeviceNumber = 22
        }else{
          data.freqDeviceNumber = 21
        }
        this.resultProcessing(data)
        break
      case '22'://波长
        data.result = 1
        data.timeout = 0

        dBma  = Number(this.roundNumber(parseFloat(arrayData[2])*1000000000, 4))
        if(dBma !== 0){
          this.smodeNumVals[1].push(dBma)

          console.log(this.smodeNum)
          // 异步存储数据
          if(this.smodeNumVals[1].length === 50 || this.smodeNum === this.initialData.gainPowerNum){
            await this.saveData(this.smodeNumVals)
            console.log(this.sn,this.smodeNumVals)
            this.vueInstance.addConsole(this.sn,this.sn+'稳定性测试完成存储，当前（'+this.smodeNum+'）次', 'danger')
            this.smodeNumVals = [[],[]]
          }else{
            if(this.smodeNum % 10 === 0 ){
              this.vueInstance.addConsole(this.sn,this.sn+'稳定性测试完成（'+this.smodeNum+'）次', 'danger')
            }
          }

          if(this.smodeNum === this.initialData.gainPowerNum){
            await this.stopComm()
            return false
          }
          this.smodeNum++
          data.result = 1
          data.freqDeviceNumber = 19
          data.timeout = 2000
        }else{
          data.result = 0
          data.freqDeviceNumber = 22
        }
        this.resultProcessing(data)
    }
    return false
  }

  /**
   * 协议处理函数
   */
  async resultProcessing(data,type = 0) {
    if (!this.vueInstance) {
      throw new Error('Vue实例未注册');
    }
    if(data['freqDeviceNumber'] ===this.oldData['freqDeviceNumber']){
      this.oldNum++
    }else{
      this.oldNum = 0
    }
    //console.log(data['freqDeviceNumber'],this.oldData['freqDeviceNumber'])
    if(this.oldNum===10){
      this.vueInstance.addConsole(this.sn,'当前指令无法执行，停止运行', 'danger')
      return false
    }
    //data['timeout'] = 1000
    this.oldData = data
    if (data['timeout'] === 0) {
      await this.vueInstance.sendComm(this.sn, data['freqDeviceNumber'], data['param'])
      return false
    }

    setTimeout(function() {
      this.vueInstance.sendComm(this.sn, data['freqDeviceNumber'], data['param'])
    }.bind(this), data['timeout'])
  }

  /**
   * 保留小数位数,返回字符串
   * @param number
   * @param decimals
   * @returns {string}
   */
  roundNumber(number,decimals) {
    var newString = '',    // The new rounded number
      numString,
      pointIndex = -1,
      oriDecimals = 0,   // 原小数位数
      i = 0,
      deltData = 0,
      singleChar = '',
      singleData = 0,
      symbol = "",       // 符号
      ePos = -1,         // 科学计数法中e的位置
      suffix = "";       // 科学计数法后缀

    number = Number(number);
    decimals = Number(decimals);

    if (number < 0) {
      symbol = "-";
    }

    if (decimals < 1) {
      newString = (Math.round(number)).toString();
    } else {
      number = Math.abs(number);
      numString = number.toString();

      ePos = numString.indexOf("e");
      if (-1 === ePos) {
        ePos = numString.indexOf("E");
      }
      if (-1 !== ePos) {
        suffix = numString.substr(ePos);
      }

      pointIndex = numString.indexOf(".");

      if (-1 === pointIndex) {
        numString += ".";
        pointIndex = numString.length - 1;
      }

      oriDecimals = numString.length - pointIndex - 1;

      // 补充字符串长度
      if (oriDecimals < decimals) {
        numString += new Array(decimals - oriDecimals + 1).join("0");
      }

      if (Number(numString.charAt(pointIndex + decimals + 1)) >= 5) {
        deltData = 1;
      }
      for (i = pointIndex + decimals; i >= 0; i -= 1) {
        if ("." === numString.charAt(i)) {
          newString = "." + newString;
          continue;
        }

        singleData = Number(numString.charAt(i));
        if (9 === singleData &&
          1 === deltData) {
          singleChar = "0";
          deltData = 1;
        } else {
          singleChar = (singleData + deltData).toString();
          deltData = 0;
        }

        newString = singleChar + newString;
      }

      if (1 === deltData) {
        newString = "1" + newString;
      }

      newString = symbol + newString;
    }

    return newString + suffix;
  }

  getNm(arrayData) {
    return parseInt(parseFloat(arrayData) * 1000 * 1000 * 1000)
  }

  async stopComm(){
    let data=[]

      data.result = 1
      data.freqDeviceNumber = 23
      this.resultProcessing(data)
    this.vueInstance.addConsole(this.sn,this.sn+'停止运行', 'danger')
    await this.vueInstance.closeWorkers(this.sn);
  }
  async saveData(gain){
    let param = {
      'frequemcy': JSON.stringify(gain),
      'config': JSON.stringify(gain),
      'sz_sn': this.sn,
      'name': this.sn + '_' + this.nextSign,
      'device_id': '1',
      'type': 12,
      'serial_number': this.commData.SerialNumber,
      'ip': '127.0.0.1',
      'remoteDir': '',
      'filename': 'stability',
      'postType':'2',
      'switchStatus':this.switchStatus,
      'gainPowerNum':this.initialData.gainPowerNum
    }
    await this.vueInstance.saveData(this.sn, param)
    return false
  }
}

Comlink.expose(VueAccessorWorker);
