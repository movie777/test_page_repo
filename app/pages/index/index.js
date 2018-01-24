(function(){

	var globalTemp = null;
	var globalPrec = null;
	var selectElem = document.querySelectorAll('.select_weather');
	var selectDataType = document.querySelectorAll('.btn-type');
	var selectScheduleType = document.querySelectorAll('.schedule-type');
	var buttonAdd = document.getElementsByClassName('button_load-data');
	var preloader = document.getElementsByClassName('preloader');
	var canvasBox = document.getElementsByClassName('canvas-box');
	var canvas = document.getElementById('canvas');
	var ctx = canvas.getContext('2d');
	var yearsParam = '';
	var scheduleParam;
	var dataTypeParam;
	var totalMeteoDtaObject;

	//события
	for(let i = 0; i < selectElem.length; i++){ //выбор дат
		selectElem[i].onclick = getSelectData;	
	}
	for(let i = 0; i < selectDataType.length; i++){ //выбор типов отображаемых данных(осадки, температура) 
		selectDataType[i].onclick = selectData; //при переключении пользователем
		if(selectDataType[i].getAttribute('btn-data-type') == 'temperature'){ //при первой загрузке
			selectDataType[i] = selectData.call(selectDataType[i]);
		}
			
	}
	for(let i = 0; i < selectScheduleType.length; i++){ //выбор типов таблиц отображаемых данных
		selectScheduleType[i] = getScheduleType.call(selectScheduleType[i]);	
	}

	buttonAdd[0].onclick = loadData; //кнопка "показать"

	//функция получения типов отображаемых таблиц
	function getScheduleType(){

		for(let i = 0; i < selectScheduleType.length; i++){ //добавление класса активной таблицы при первоначальной загрузке
			selectScheduleType[i].classList.remove('active');
			selectScheduleType[0].classList.add('active');
			
		}

		if(this.classList.contains('active'))
				scheduleParam = this.getAttribute('schedule-type'); //запись ключа активной таблицы

		this.onclick = function(){ //добавление класса и ключа активной таблицы при переключении пользователем 

			for(let i = 0; i < selectScheduleType.length; i++){
				selectScheduleType[i].classList.remove('active');

			}

			this.classList.add('active');
			
			scheduleParam = this.getAttribute('schedule-type');

			scheduleBuild(totalMeteoDtaObject,scheduleParam);


		}

	}

	//функция получения интервала выбранных дат
	function getYearsInterval(){
		yearsParam = selectElem[0].getAttribute('data-value')+'-'+selectElem[1].getAttribute('data-value');
		return yearsParam;

	}

	//функция записи значений активных селектов 
	function getSelectData(){

		var index = this.options.selectedIndex;
		var yearIndex = this.options[index].value;
		this.setAttribute('data-value',yearIndex);
		getYearsInterval();

	}

	//функция записи ключа выбранного типа данных(осадки, температура) 
	function selectData(){

		for(let i = 0; i < selectDataType.length; i++){
			selectDataType[i].classList.remove('active')
		}

		this.classList.add('active');
		dataTypeParam = this.getAttribute('btn-data-type');

		loadData();// ызов функции загрузки данных в таблицу при переключении пользователем

	}

	//функция вывода option в select из загруженных данных
	function addOptionsList(arr,attr){

		if(!this.childNodes.length){ // если селект не имеет доступных для пользователя данных

			var string = '';		
			var indexLoadYear;

			for(let i = 0; i < arr.length; i++){

				if(attr == 'true'){
					if(arr[i] == arr[0])
						string += '<option selected val='+ arr[i] +'>'+ arr[i] +'</option>';
					else
						string += '<option val='+ arr[i] +'>'+ arr[i] +'</option>';
				}

				else{
					if(arr[i] == arr[arr.length-1])
						string += '<option selected val='+ arr[i] +'>'+ arr[i] +'</option>';
					else
						string += '<option val='+ arr[i] +'>'+ arr[i] +'</option>';
				}	
				
			}

			this.innerHTML = string;
		}

	}

	//функция выбора при первоначальной загрузке данных 
	function loadData() {

		//если браузер поддерживает IndexedDB (далее работа с IndexedDB)
		if(window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB){
			loadIndexedDb(dataTypeParam);

			if( /iPhone|iPad/i.test(navigator.userAgent) && (navigator.appVersion.match(/Safari/i)) ){
				loadDataServer(false);
			}

		}

		//если нет (далее работа с глобальным массивом)
		else{

			switch(dataTypeParam){

				case "temperature": // если ключ типа отображаемых данных
					if(globalTemp != null) // ищем в глобальном массиве и запускаем обработку полученных из него данных
						parseData(globalTemp,dataTypeParam);

					else // иначе запускаем функцию загрузки с сервера
						loadDataServer(false); 
					break;

				case "precipitation":
					if(globalPrec != null)
						parseData(globalPrec,dataTypeParam);
					else
						loadDataServer(false);
					break;

				default:
					loadDataServer(false);

			}

		}
		
	}

	//функция загрузки из IndexedDB
	function loadIndexedDb(dataTypeParam){

		var getData;
		var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
		var open = indexedDB.open('newDatabase', 1);
		var db;
		var store;
		var index;
		var trans;

		open.onupgradeneeded = function() {
			db = open.result;
			store = db.createObjectStore('newObject', {keyPath: "id"});
			index = store.createIndex('nameIndex','data');
		};

		open.onsuccess = function() {
			db = open.result;
			trans = db.transaction('newObject', 'readwrite');
			store = trans.objectStore('newObject');
			index = store.index('nameIndex');

			switch(dataTypeParam){

				case "temperature": // если ключ типа отображаемых данных
					getData = store.get(1); // получаем обект изи локального хранилища

					getData.onsuccess = function() {

						if(getData['result'] == undefined){ // если поле с данными в обьекте == undefined

							loadDataServer(true); // загружаем с сервера полный json с данными по выбранному типу данных

						}
						else{ // иначе проверяем наличие данных в базе по текущему запросу 

							let key = yearsParam + ':' + dataTypeParam;
							let query  = store.get(key);

							query.onsuccess = function() {

								if( query ['result'] != undefined && key == query ['result']['id']){ // если данные по текущему запросу есть в базе

									createCanvasSchedule(query ['result']['data']); // передаем обьект данных для конкретного текущего запроса в функцию построения таблиц

								}
								
								else{ // иначе получаем полный json из базы и передаем на просчет по текущему запросу
									parseData(getData['result']['data'],dataTypeParam);
								}

								
							}
						}

					}
					   				       
				break;

				case "precipitation":
					getData = store.get(2);

					getData.onsuccess = function() {

						if(getData['result'] == undefined){

							loadDataServer(true);

						}
						else{
							
							let key = yearsParam + ':' + dataTypeParam;
							let query = store.get(key);

							query.onsuccess = function() {

								if( query ['result'] != undefined && key == query ['result']['id']){

									createCanvasSchedule(query ['result']['data']);

								}
								
								else{
									parseData(getData['result']['data'],dataTypeParam);
								}

								
							}
							
						}

					}
					   				       
				break;

				default:
					loadDataServer(true);

			}

		trans.oncomplete = function() {

				db.close();
			};

		}

	}

	//функция добавления в IndexedDB полных данных по типу отображаемых данных
	function addIndexedDb(data){

		var getData;
		var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
		var open = indexedDB.open('newDatabase', 1);
		var db;
		var store;
		var index;
		var trans;

		open.onupgradeneeded = function() {
			db = open.result;
			store = db.createObjectStore('newObject', {keyPath: "id"});
			index = store.createIndex('nameIndex','data');
		};

		open.onsuccess = function() {
			db = open.result;
			trans = db.transaction('newObject', 'readwrite');
			store = trans.objectStore('newObject');
			index = store.index('nameIndex');

			if(dataTypeParam == 'temperature'){ // если ключ типа отображаемых данных

				store.put({id: 1, data: data}); // запись данных полного обьекта json по типу запрашиваемых данных в db
				getData = store.get(1); // получение из db обекта с данными

				getData.onsuccess = function() {

					parseData(getData['result']['data'],dataTypeParam); // отправка обьекта с данными и интервала дат в функцию просчета

				};

			}

			if(dataTypeParam == 'precipitation'){

				store.put({id: 2, data: data});
				getData = store.get(2);

				getData.onsuccess = function() {

					parseData(getData['result']['data'],dataTypeParam);

				};

			}

			trans.oncomplete = function() {
				db.close();

			};
		}

	}

	//функция добавления в IndexedDB данных по типу и конкретному интервалу отображаемых данных
	function addInDbNewObject(obj){

		var getData;
		var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
		var open = indexedDB.open('newDatabase', 1);
		var db;
		var store;
		var index;
		var trans;

		open.onupgradeneeded = function() {
			db = open.result;
			store = db.createObjectStore('newObject', {keyPath: "id"});
			index = store.createIndex('nameIndex','data');
		};

		open.onsuccess = function() {
			db = open.result;
			trans = db.transaction('newObject', 'readwrite');
			store = trans.objectStore('newObject');
			index = store.index('nameIndex');
			key = obj['period'] +':'+ obj['dataType']
			store.put({id: key, data: obj}); // запись обекта просчитанных данных с текушего запроса по указанному интервалу в db
			getData = store.get(key);

			trans.oncomplete = function() {
				db.close();

			};
		}
	}

	// функция загрузки данных с сервера
	function loadDataServer(isIndexDb) {

		//отображение прелоадера
		canvasBox[0].setAttribute('style','opacity: 0;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');
		preloader[0].setAttribute('style','opacity: 1;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');

		return new Promise(function(resolve, reject){ //

			var xhr = new XMLHttpRequest();

			xhr.open('GET', 'libs/'+ dataTypeParam +'.json', true);

			xhr.onreadystatechange = function() {
				
				if (xhr.readyState != 4) return;

				if (xhr.status != 200) {

					reject(console.log('server-error!'));
				}

				else {

					try {
						var data = JSON.parse(xhr.responseText);
						
					} 
					catch (e) {
						alert( "Что то пошло не так! Попробуйте повторить попытку позднее ||"  + e.message );
					}

					if(isIndexDb == true){ // если indexedDb

						if(dataTypeParam == 'temperature' || dataTypeParam == 'precipitation'){
							addIndexedDb(data); // передача загруженных данных в функцию записи в db

						}

					}
					else{ // иначе запись полученных данных в глобальный массив

						if(dataTypeParam == 'temperature'){
							globalTemp = data;
							parseData(globalTemp,dataTypeParam); // передача загруженных данных в функцию просчета данных

						}
						if(dataTypeParam == 'precipitation'){
							globalPrec = data;
							parseData(globalPrec,dataTypeParam);
						}
					}

					// скрытие прелоадера
					resolve((function(){
						canvasBox[0].setAttribute('style','opacity: 1;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');
						preloader[0].setAttribute('style','opacity: 0;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');
					})());
	
				}

			}

			xhr.send();

		});

	}


	// функция просчета данных
	function parseData(data,dataTypeParam) {

		var arrYears = [];// массив общего кол-ва дат
		var indexLoad;
		var indexLoadYear;
		

		//console.log(data);

		for(let i = 0; i<data.length - 1; i++){

			if(data[i]['t'].split('-')[0] == data[i+1]['t'].split('-')[0] && data[i+1] != data[data.length - 1])
			 	continue

			arrYears.push(data[i]['t'].split('-')[0]);
			
		}

		for(let i = 0; i < selectElem.length; i++){ // вывод дат в select установка ключей в атрибуты и получение значений из option
			selectElem[i] = addOptionsList.call(selectElem[i],arrYears,selectElem[i].getAttribute('option-list'));
			indexLoad = selectElem[i].options.selectedIndex;
			indexLoadYear = selectElem[i].options[indexLoad].value;
			selectElem[i].setAttribute('data-value',indexLoadYear);

		}
		
		if(window.Worker) { // если поддерживается обьект worker

			let obj = {};
			let worker;
			let errorObj = {};

			if(parseInt(getYearsInterval().split('-')[0]) > parseInt(getYearsInterval().split('-')[1])){ // если дата из первого селекта больше даты из второго

				function totalObject(years,dataTypeParam){ // создание обьекта конечных данных с полем ошибки

					this.objectType = 'totalSchedule';
					this.dataType = dataTypeParam;							
					this.period = years;
					this.errorData = true;
					
				}

				errorObj = new totalObject(getYearsInterval(),dataTypeParam);
				createCanvasSchedule(errorObj); //передача обекта в функцию отображения таблиц

			}
			else{ // иначе передача загруженных с сервера данных и установленного интервала в worker для просчета

				obj.data     = data;
				obj.interval = getYearsInterval();
				obj.param    = dataTypeParam;

				worker = new Worker('libs/workers/calculation.js');
				//плелоадер до просчета данных
				canvas.setAttribute('style','opacity: 0;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');
				preloader[0].setAttribute('style','opacity: 1;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;z-index:99;');
				worker.postMessage(obj);

				worker.onmessage = function(event){

					// скрытие прелоадера после
					preloader[0].setAttribute('style','opacity: 0;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;z-index:-1;');
					canvas.setAttribute('style','opacity: 1;-webkit-transition: all 0.3s;-o-transition: all 0.3s;-moz-transition: all 0.3s;');
					
					createCanvasSchedule(event['data']);// передача сформированного после просчета обекта с данными помесячно
					addInDbNewObject(event['data']); // запись обекта в indexed Db 

				}

			}
		}
		else{ // иначе просчет данных в основном потоке в функции parseYearData()

			if(parseInt(getYearsInterval().split('-')[0]) > parseInt(getYearsInterval().split('-')[1])){

				function totalObject(years,dataTypeParam){

					this.objectType = 'totalSchedule';
					this.dataType = dataTypeParam;							
					this.period = years;
					this.errorData = true;
					
				}

				errorObj = new totalObject(getYearsInterval(),dataTypeParam);
				createCanvasSchedule(errorObj);

			}
			else{
				parseYearData(data,getYearsInterval(),dataTypeParam);
			}
		}		
	}

	//просчет полученных данных если нет поддержки worker
	function parseYearData(data,years,dataTypeParam){
		var topYear = parseInt(years.split('-')[0]);
		var bottYear = parseInt(years.split('-')[1]);
		var countYears = bottYear - topYear + 1;
		var sum = [];
		var totalMeteoData;

		function totalObject(years,dataTypeParam){

			this.objectType = 'totalSchedule';
			this.dataType = dataTypeParam;
			this.period = years;
			
		}

		if(topYear <= bottYear ){
			for(let i = 0; i<= data.length-1; i++){
				
				if(parseInt(data[i]['t'].split('-')[0]) >= topYear && parseInt(data[i]['t'].split('-')[0]) <= bottYear)
					sum.push(data[i]);

			}

			function eachMonth(arr,month,countYears){

				var totalDays = [];
				var resultReturn;
				var result;
				var total = 0;

				for(let i = 0; i<arr.length - 1; i++){

					if(arr[i]['t'].split('-')[1] == month){

					 	totalDays.push(arr[i]['v']);
					 	total++;

					}
					
				}

				result = totalDays.reduce(function(sumNext, current) {

						return sumNext + current;

				}, 0);

				resultReturn = parseFloat(result.toFixed(1))/total

				return parseFloat(resultReturn.toFixed(1));
			}
		

			totalObject.prototype.addMonth = function(sum,countYears){

				this['totalJanuary-01']   = eachMonth(sum,'01',countYears);
				this['totalFebruary-02']  = eachMonth(sum,'02',countYears);
				this['totalMarch-03'] 	  = eachMonth(sum,'03',countYears);
				this['totalApril-04'] 	  = eachMonth(sum,'04',countYears);
				this['totalMay-05'] 	  = eachMonth(sum,'05',countYears);
				this['totalJune-06']      = eachMonth(sum,'06',countYears);
				this['totalJuly-07'] 	  = eachMonth(sum,'07',countYears);
				this['totalAugust-08']    = eachMonth(sum,'08',countYears);
				this['totalSeptember-09'] = eachMonth(sum,'09',countYears);
				this['totalOctober-10']   = eachMonth(sum,'10',countYears);
				this['totalNovember-11']  = eachMonth(sum,'11',countYears);
				this['totalDecember-12']  = eachMonth(sum,'12',countYears);
	
			}
			
			totalMeteoData = new totalObject(years,dataTypeParam);
			totalMeteoData.addMonth(sum,countYears);
			console.log(totalMeteoData);
			createCanvasSchedule(totalMeteoData);
				
		}
		else{

			totalObject.prototype.addErrorData = function(){

				this.errorData = true;			
			}

			totalMeteoData.addErrorData();
			createCanvasSchedule(totalMeteoData);

		}

	}

	//функция создания таблицы 
	function createCanvasSchedule(obj){

		console.log(obj)

		totalMeteoDtaObject = obj;

		var title = document.querySelectorAll('.canvas-title');
		var type;

		if(obj['dataType'] == 'temperature')
			type = 'Температура';
		if(obj['dataType'] == 'precipitation')
			type = 'Осадки';
		
		
		//весли поле с ошибкой вывод сообщение об неверно введенных данных и отчистка холста
		if(obj['errorData']){
	
			ctx.clearRect(0, 0, 850, 550);

			title[0].classList.add('on-error');
			title[0].innerHTML = 'Нельзя отобразить данные за выбранный период!';

		}

		//вывод заголовка с указанием отображаемых данных
		if(!obj['errorData'] && obj['period'].split('-')[0] == obj['period'].split('-')[1]){

			title[0].classList.remove('on-error');
			title[0].innerHTML = ''+ type +' за '+ obj['period'].split('-')[0] +' год';

		}

		if(!obj['errorData'] && obj['period'].split('-')[0] != obj['period'].split('-')[1]){

			title[0].classList.remove('on-error');
			title[0].innerHTML = ''+ type +' с '+ obj['period'].split('-')[0] +' по '+ obj['period'].split('-')[1] +' годы';

		}

		if(!obj['errorData']){

			scheduleBuild(obj,scheduleParam); // построение таблицы
			
		}

	}

	function scheduleBuild(obj,scheduleParam){

		console.log(scheduleParam,obj);
	
		var pi = Math.PI;
		var count = 40;
		var countLine = 40;
		var countWrapp = 40;
		var lineDivision  = 10;
		var countDivision  = 50;
		var arr = [];
		var time = 0;
		var lightBlue = '#b4e6f9';
		var blue = '#4285f4';
		var black = '#000';
		var lightYellow = '#f5da9f';
		var circR = 3;
		var circL = 8;
		var circD = circR*2 + circL*2;

		ctx.clearRect(0, 0, 850, 550);

		if(scheduleParam == 'true' && !obj['errorData']){

			buildLines(obj);
			strokeMonth(count);

			for(key in obj){

				if(typeof obj[key] == 'number'){

						if(opposite(obj[key]) == true){

							if(obj['dataType'] == 'temperature'){

								ctx.fillStyle = black;
								ctx.fillText('+' + obj[key], count-10, - obj[key]*5 + 235 , 40 );
								ctx.beginPath();

								ctx.strokeStyle = lightYellow;
								ctx.moveTo(count, - obj[key]*5 + 255);                        
								ctx.lineTo(count, 260);
								ctx.lineWidth = 4;
								ctx.lineCap = 'butt'; 
								ctx.stroke();
								ctx.beginPath();

								ctx.lineWidth = circL;
								ctx.fillStyle = blue;
								ctx.arc(count, -obj[key]*5 + 271 - circD/2, circR, 0, 2*pi, false);
								ctx.stroke();
								ctx.fill();
								ctx.beginPath(); 

							}
							if(obj['dataType'] == 'precipitation'){

								ctx.fillStyle = black;
								ctx.fillText(obj[key], count-10, - obj[key]*50 + 235 , 40 );
								ctx.beginPath();

								ctx.strokeStyle = lightBlue;
								ctx.moveTo(count, - obj[key]*50 + 255);                        
								ctx.lineTo(count, 260);
								ctx.lineWidth = 1;
								ctx.lineCap = 'butt'; 
								ctx.stroke();
								ctx.beginPath();

								ctx.lineWidth = circL;
								ctx.fillStyle = blue;
								ctx.arc(count, -obj[key]*50 + 271 - circD/2, circR, 0, 2*pi, false);
								ctx.stroke();
								ctx.fill();
								ctx.beginPath(); 

							}

						}
	
						else{

							ctx.fillStyle = blue;
							ctx.fillText(obj[key], count-10, - obj[key]*5 + 280, 40 );
							ctx.beginPath();

							ctx.moveTo(count, 260);                        
							ctx.lineTo(count, - obj[key]*5 + 265);                       
							ctx.lineWidth = 4; 
							ctx.lineCap = 'butt'; 
							ctx.strokeStyle = lightBlue;
							ctx.stroke();
							ctx.beginPath();

							ctx.lineWidth = circL;
							ctx.strokeStyle = lightBlue
							ctx.fillStyle = blue;
							ctx.arc(count, -obj[key]*5 + 248.5 + circD/2, circR, 0, 2*pi, false);
							
							ctx.stroke();
							ctx.fill();
							ctx.beginPath();

						}

						count += 60;
						arr.push(obj[key]);
				}	
			}

			
			for(let i = 0; i < arr.length; i++){

				setTimeout(function(){

					if(obj['dataType'] == 'temperature'){
						ctx.moveTo(countLine, -arr[i]*5 + 260);
						countLine += 60;                      
						ctx.lineTo(countLine, -arr[i+1]*5 + 260);
					}

					if(obj['dataType'] == 'precipitation'){
						ctx.moveTo(countLine, -arr[i]*50 + 260);
						countLine += 60;                      
						ctx.lineTo(countLine, -arr[i+1]*50 + 260);
					}
					
					ctx.lineWidth = 3;    
					ctx.strokeStyle = blue
					ctx.stroke();
					ctx.beginPath();

				},time += 25);

			 }
			
		}
		if(scheduleParam == 'false' && !obj['errorData']){

			buildLines(obj);
			strokeMonth(count);

			for(key in obj){

				if(typeof obj[key] == 'number'){

						if(obj['dataType'] == 'temperature'){

							if(opposite(obj[key]) == true){
								ctx.fillStyle = lightYellow;
								ctx.rect(count, 260, 30, - obj[key]*5 );
								ctx.lineCap = 'round';
								ctx.fill();
								ctx.beginPath();

								ctx.fillStyle = black;
								ctx.font = 'bold 14px sans-serif';
								ctx.fillText(obj[key], count, - obj[key]*5 + 245, 30 );
								ctx.beginPath();
							}
								
							else{
								ctx.fillStyle = lightBlue;
								ctx.rect(count, 260, 30, - obj[key]*5 );
								ctx.lineCap = 'round';
								ctx.fill();
								ctx.beginPath();
								ctx.fillStyle = black;
								ctx.font = 'bold 14px sans-serif';
								ctx.fillText(obj[key], count, - obj[key]*5 + 280, 30 );
								ctx.beginPath();
							}

							count += 60;

						}
						if(obj['dataType'] == 'precipitation'){

							ctx.fillStyle = lightBlue;
							ctx.rect(count, 260, 30, - obj[key]*50 );
							ctx.lineCap = 'round';
							ctx.fill();
							ctx.beginPath();
							ctx.fillStyle = black;
							ctx.font = 'bold 14px sans-serif';							
							ctx.fillText(obj[key], count, - obj[key]*50 + 255, 30 );							
							count += 60;
					}					
				}		

			}
			
		}

		function opposite(num){

			if(num > 0) return true

			else return false
		
		}

		function strokeMonth(count){

			var month = ['январь', 
						 'февраль',
						 'март',
						 'апрель',
						 'май', 
						 'июнь',
						 'июль', 
						 'август',
						 'сентябрь', 
						 'октябрь',
						 'ноябрь',
						 'декабрь'];

			for(let i = 0; i<12; i++){

				ctx.fillStyle = '#4285f4';
				ctx.font = ' 11px sans-serif';
				ctx.fillText(month[i], count, 530, 50 );

				count += 60;
			}

		}

		function buildLines(obj){

			ctx.moveTo(5, 263 - 3);			
			ctx.lineTo(702, 263 - 3);          
			ctx.lineWidth = 1;      
			ctx.strokeStyle = lightBlue ;
			ctx.lineCap = 'butt';                  
			ctx.stroke();
			ctx.beginPath();

			if(obj['dataType'] == 'temperature') {

				for(let i = 0; i < 11; i++){

					ctx.font = 'bold 12px sans-serif';
					ctx.fillStyle = lightBlue;
					if(countDivision == 0)
						ctx.fillText('', 10, lineDivision + 4 , 30 );

					else
						ctx.fillText(countDivision, 10, lineDivision + 4 , 30 );
					countDivision -= 10;
					ctx.beginPath();

					ctx.fillStyle = lightBlue
					ctx.arc(5, lineDivision, 3, 0, 2*pi, false);
					lineDivision += 50;
					ctx.fill();
					ctx.beginPath();

					ctx.moveTo(5, 10);                 
					ctx.lineTo(5, 510);                       
					ctx.lineWidth = 2;      
					ctx.strokeStyle = lightBlue  
					ctx.lineCap = 'round';                     
					ctx.stroke();
					ctx.beginPath();

				}

			}
			if(obj['dataType'] == 'precipitation') {

				for(let i = 0; i < 6; i++){

					ctx.font = 'bold 12px sans-serif';
					ctx.fillStyle = lightBlue;

					if(countDivision == 0)
						ctx.fillText('', 10, lineDivision + 4 , 30 );

					else
						ctx.fillText(countDivision.toString()[0], 10, lineDivision + 4 , 30 );
					countDivision -= 10;
					ctx.beginPath();

					ctx.fillStyle = lightBlue;
					ctx.arc(5, lineDivision, 3, 0, 2*pi, false);
					lineDivision += 50;
					ctx.fill();
					ctx.beginPath();

					ctx.moveTo(5, 10);              
					ctx.lineTo(5, 260);                       
					ctx.lineWidth = 2;      
					ctx.strokeStyle = lightBlue  
					ctx.lineCap = 'round';                     
					ctx.stroke();
					ctx.beginPath();

				}	
			}			
		}
	}

})();
