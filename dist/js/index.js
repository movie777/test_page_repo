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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7XHJcblxyXG5cdHZhciBnbG9iYWxUZW1wID0gbnVsbDtcclxuXHR2YXIgZ2xvYmFsUHJlYyA9IG51bGw7XHJcblx0dmFyIHNlbGVjdEVsZW0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuc2VsZWN0X3dlYXRoZXInKTtcclxuXHR2YXIgc2VsZWN0RGF0YVR5cGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuYnRuLXR5cGUnKTtcclxuXHR2YXIgc2VsZWN0U2NoZWR1bGVUeXBlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNjaGVkdWxlLXR5cGUnKTtcclxuXHR2YXIgYnV0dG9uQWRkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnYnV0dG9uX2xvYWQtZGF0YScpO1xyXG5cdHZhciBwcmVsb2FkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdwcmVsb2FkZXInKTtcclxuXHR2YXIgY2FudmFzQm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnY2FudmFzLWJveCcpO1xyXG5cdHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyk7XHJcblx0dmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xyXG5cdHZhciB5ZWFyc1BhcmFtID0gJyc7XHJcblx0dmFyIHNjaGVkdWxlUGFyYW07XHJcblx0dmFyIGRhdGFUeXBlUGFyYW07XHJcblx0dmFyIHRvdGFsTWV0ZW9EdGFPYmplY3Q7XHJcblxyXG5cdC8v0YHQvtCx0YvRgtC40Y9cclxuXHRmb3IobGV0IGkgPSAwOyBpIDwgc2VsZWN0RWxlbS5sZW5ndGg7IGkrKyl7IC8v0LLRi9Cx0L7RgCDQtNCw0YJcclxuXHRcdHNlbGVjdEVsZW1baV0ub25jbGljayA9IGdldFNlbGVjdERhdGE7XHRcclxuXHR9XHJcblx0Zm9yKGxldCBpID0gMDsgaSA8IHNlbGVjdERhdGFUeXBlLmxlbmd0aDsgaSsrKXsgLy/QstGL0LHQvtGAINGC0LjQv9C+0LIg0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINC00LDQvdC90YvRhSjQvtGB0LDQtNC60LgsINGC0LXQvNC/0LXRgNCw0YLRg9GA0LApIFxyXG5cdFx0c2VsZWN0RGF0YVR5cGVbaV0ub25jbGljayA9IHNlbGVjdERhdGE7IC8v0L/RgNC4INC/0LXRgNC10LrQu9GO0YfQtdC90LjQuCDQv9C+0LvRjNC30L7QstCw0YLQtdC70LXQvFxyXG5cdFx0aWYoc2VsZWN0RGF0YVR5cGVbaV0uZ2V0QXR0cmlidXRlKCdidG4tZGF0YS10eXBlJykgPT0gJ3RlbXBlcmF0dXJlJyl7IC8v0L/RgNC4INC/0LXRgNCy0L7QuSDQt9Cw0LPRgNGD0LfQutC1XHJcblx0XHRcdHNlbGVjdERhdGFUeXBlW2ldID0gc2VsZWN0RGF0YS5jYWxsKHNlbGVjdERhdGFUeXBlW2ldKTtcclxuXHRcdH1cclxuXHRcdFx0XHJcblx0fVxyXG5cdGZvcihsZXQgaSA9IDA7IGkgPCBzZWxlY3RTY2hlZHVsZVR5cGUubGVuZ3RoOyBpKyspeyAvL9Cy0YvQsdC+0YAg0YLQuNC/0L7QsiDRgtCw0LHQu9C40YYg0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINC00LDQvdC90YvRhVxyXG5cdFx0c2VsZWN0U2NoZWR1bGVUeXBlW2ldID0gZ2V0U2NoZWR1bGVUeXBlLmNhbGwoc2VsZWN0U2NoZWR1bGVUeXBlW2ldKTtcdFxyXG5cdH1cclxuXHJcblx0YnV0dG9uQWRkWzBdLm9uY2xpY2sgPSBsb2FkRGF0YTsgLy/QutC90L7Qv9C60LAgXCLQv9C+0LrQsNC30LDRgtGMXCJcclxuXHJcblx0Ly/RhNGD0L3QutGG0LjRjyDQv9C+0LvRg9GH0LXQvdC40Y8g0YLQuNC/0L7QsiDQvtGC0L7QsdGA0LDQttCw0LXQvNGL0YUg0YLQsNCx0LvQuNGGXHJcblx0ZnVuY3Rpb24gZ2V0U2NoZWR1bGVUeXBlKCl7XHJcblxyXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IHNlbGVjdFNjaGVkdWxlVHlwZS5sZW5ndGg7IGkrKyl7IC8v0LTQvtCx0LDQstC70LXQvdC40LUg0LrQu9Cw0YHRgdCwINCw0LrRgtC40LLQvdC+0Lkg0YLQsNCx0LvQuNGG0Ysg0L/RgNC4INC/0LXRgNCy0L7QvdCw0YfQsNC70YzQvdC+0Lkg0LfQsNCz0YDRg9C30LrQtVxyXG5cdFx0XHRzZWxlY3RTY2hlZHVsZVR5cGVbaV0uY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XHJcblx0XHRcdHNlbGVjdFNjaGVkdWxlVHlwZVswXS5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcclxuXHRcdFx0XHJcblx0XHR9XHJcblxyXG5cdFx0aWYodGhpcy5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGl2ZScpKVxyXG5cdFx0XHRcdHNjaGVkdWxlUGFyYW0gPSB0aGlzLmdldEF0dHJpYnV0ZSgnc2NoZWR1bGUtdHlwZScpOyAvL9C30LDQv9C40YHRjCDQutC70Y7Rh9CwINCw0LrRgtC40LLQvdC+0Lkg0YLQsNCx0LvQuNGG0YtcclxuXHJcblx0XHR0aGlzLm9uY2xpY2sgPSBmdW5jdGlvbigpeyAvL9C00L7QsdCw0LLQu9C10L3QuNC1INC60LvQsNGB0YHQsCDQuCDQutC70Y7Rh9CwINCw0LrRgtC40LLQvdC+0Lkg0YLQsNCx0LvQuNGG0Ysg0L/RgNC4INC/0LXRgNC10LrQu9GO0YfQtdC90LjQuCDQv9C+0LvRjNC30L7QstCw0YLQtdC70LXQvCBcclxuXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCBzZWxlY3RTY2hlZHVsZVR5cGUubGVuZ3RoOyBpKyspe1xyXG5cdFx0XHRcdHNlbGVjdFNjaGVkdWxlVHlwZVtpXS5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XHJcblx0XHRcdFxyXG5cdFx0XHRzY2hlZHVsZVBhcmFtID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ3NjaGVkdWxlLXR5cGUnKTtcclxuXHJcblx0XHRcdHNjaGVkdWxlQnVpbGQodG90YWxNZXRlb0R0YU9iamVjdCxzY2hlZHVsZVBhcmFtKTtcclxuXHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdC8v0YTRg9C90LrRhtC40Y8g0L/QvtC70YPRh9C10L3QuNGPINC40L3RgtC10YDQstCw0LvQsCDQstGL0LHRgNCw0L3QvdGL0YUg0LTQsNGCXHJcblx0ZnVuY3Rpb24gZ2V0WWVhcnNJbnRlcnZhbCgpe1xyXG5cdFx0eWVhcnNQYXJhbSA9IHNlbGVjdEVsZW1bMF0uZ2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJykrJy0nK3NlbGVjdEVsZW1bMV0uZ2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJyk7XHJcblx0XHRyZXR1cm4geWVhcnNQYXJhbTtcclxuXHJcblx0fVxyXG5cclxuXHQvL9GE0YPQvdC60YbQuNGPINC30LDQv9C40YHQuCDQt9C90LDRh9C10L3QuNC5INCw0LrRgtC40LLQvdGL0YUg0YHQtdC70LXQutGC0L7QsiBcclxuXHRmdW5jdGlvbiBnZXRTZWxlY3REYXRhKCl7XHJcblxyXG5cdFx0dmFyIGluZGV4ID0gdGhpcy5vcHRpb25zLnNlbGVjdGVkSW5kZXg7XHJcblx0XHR2YXIgeWVhckluZGV4ID0gdGhpcy5vcHRpb25zW2luZGV4XS52YWx1ZTtcclxuXHRcdHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJyx5ZWFySW5kZXgpO1xyXG5cdFx0Z2V0WWVhcnNJbnRlcnZhbCgpO1xyXG5cclxuXHR9XHJcblxyXG5cdC8v0YTRg9C90LrRhtC40Y8g0LfQsNC/0LjRgdC4INC60LvRjtGH0LAg0LLRi9Cx0YDQsNC90L3QvtCz0L4g0YLQuNC/0LAg0LTQsNC90L3Ri9GFKNC+0YHQsNC00LrQuCwg0YLQtdC80L/QtdGA0LDRgtGD0YDQsCkgXHJcblx0ZnVuY3Rpb24gc2VsZWN0RGF0YSgpe1xyXG5cclxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBzZWxlY3REYXRhVHlwZS5sZW5ndGg7IGkrKyl7XHJcblx0XHRcdHNlbGVjdERhdGFUeXBlW2ldLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpXHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcclxuXHRcdGRhdGFUeXBlUGFyYW0gPSB0aGlzLmdldEF0dHJpYnV0ZSgnYnRuLWRhdGEtdHlwZScpO1xyXG5cclxuXHRcdGxvYWREYXRhKCk7Ly8g0YvQt9C+0LIg0YTRg9C90LrRhtC40Lgg0LfQsNCz0YDRg9C30LrQuCDQtNCw0L3QvdGL0YUg0LIg0YLQsNCx0LvQuNGG0YMg0L/RgNC4INC/0LXRgNC10LrQu9GO0YfQtdC90LjQuCDQv9C+0LvRjNC30L7QstCw0YLQtdC70LXQvFxyXG5cclxuXHR9XHJcblxyXG5cdC8v0YTRg9C90LrRhtC40Y8g0LLRi9Cy0L7QtNCwIG9wdGlvbiDQsiBzZWxlY3Qg0LjQtyDQt9Cw0LPRgNGD0LbQtdC90L3Ri9GFINC00LDQvdC90YvRhVxyXG5cdGZ1bmN0aW9uIGFkZE9wdGlvbnNMaXN0KGFycixhdHRyKXtcclxuXHJcblx0XHRpZighdGhpcy5jaGlsZE5vZGVzLmxlbmd0aCl7IC8vINC10YHQu9C4INGB0LXQu9C10LrRgiDQvdC1INC40LzQtdC10YIg0LTQvtGB0YLRg9C/0L3Ri9GFINC00LvRjyDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8g0LTQsNC90L3Ri9GFXHJcblxyXG5cdFx0XHR2YXIgc3RyaW5nID0gJyc7XHRcdFxyXG5cdFx0XHR2YXIgaW5kZXhMb2FkWWVhcjtcclxuXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspe1xyXG5cclxuXHRcdFx0XHRpZihhdHRyID09ICd0cnVlJyl7XHJcblx0XHRcdFx0XHRpZihhcnJbaV0gPT0gYXJyWzBdKVxyXG5cdFx0XHRcdFx0XHRzdHJpbmcgKz0gJzxvcHRpb24gc2VsZWN0ZWQgdmFsPScrIGFycltpXSArJz4nKyBhcnJbaV0gKyc8L29wdGlvbj4nO1xyXG5cdFx0XHRcdFx0ZWxzZVxyXG5cdFx0XHRcdFx0XHRzdHJpbmcgKz0gJzxvcHRpb24gdmFsPScrIGFycltpXSArJz4nKyBhcnJbaV0gKyc8L29wdGlvbj4nO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZWxzZXtcclxuXHRcdFx0XHRcdGlmKGFycltpXSA9PSBhcnJbYXJyLmxlbmd0aC0xXSlcclxuXHRcdFx0XHRcdFx0c3RyaW5nICs9ICc8b3B0aW9uIHNlbGVjdGVkIHZhbD0nKyBhcnJbaV0gKyc+JysgYXJyW2ldICsnPC9vcHRpb24+JztcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0c3RyaW5nICs9ICc8b3B0aW9uIHZhbD0nKyBhcnJbaV0gKyc+JysgYXJyW2ldICsnPC9vcHRpb24+JztcclxuXHRcdFx0XHR9XHRcclxuXHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5pbm5lckhUTUwgPSBzdHJpbmc7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly/RhNGD0L3QutGG0LjRjyDQstGL0LHQvtGA0LAg0L/RgNC4INC/0LXRgNCy0L7QvdCw0YfQsNC70YzQvdC+0Lkg0LfQsNCz0YDRg9C30LrQtSDQtNCw0L3QvdGL0YUgXHJcblx0ZnVuY3Rpb24gbG9hZERhdGEoKSB7XHJcblxyXG5cdFx0Ly/QtdGB0LvQuCDQsdGA0LDRg9C30LXRgCDQv9C+0LTQtNC10YDQttC40LLQsNC10YIgSW5kZXhlZERCICjQtNCw0LvQtdC1INGA0LDQsdC+0YLQsCDRgSBJbmRleGVkREIpXHJcblx0XHRpZih3aW5kb3cuaW5kZXhlZERCIHx8IHdpbmRvdy5tb3pJbmRleGVkREIgfHwgd2luZG93LndlYmtpdEluZGV4ZWREQiB8fCB3aW5kb3cubXNJbmRleGVkREIgfHwgd2luZG93LnNoaW1JbmRleGVkREIpe1xyXG5cdFx0XHRsb2FkSW5kZXhlZERiKGRhdGFUeXBlUGFyYW0pO1xyXG5cclxuXHRcdFx0aWYoIC9pUGhvbmV8aVBhZC9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkgJiYgKG5hdmlnYXRvci5hcHBWZXJzaW9uLm1hdGNoKC9TYWZhcmkvaSkpICl7XHJcblx0XHRcdFx0bG9hZERhdGFTZXJ2ZXIoZmFsc2UpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8v0LXRgdC70Lgg0L3QtdGCICjQtNCw0LvQtdC1INGA0LDQsdC+0YLQsCDRgSDQs9C70L7QsdCw0LvRjNC90YvQvCDQvNCw0YHRgdC40LLQvtC8KVxyXG5cdFx0ZWxzZXtcclxuXHJcblx0XHRcdHN3aXRjaChkYXRhVHlwZVBhcmFtKXtcclxuXHJcblx0XHRcdFx0Y2FzZSBcInRlbXBlcmF0dXJlXCI6IC8vINC10YHQu9C4INC60LvRjtGHINGC0LjQv9CwINC+0YLQvtCx0YDQsNC20LDQtdC80YvRhSDQtNCw0L3QvdGL0YVcclxuXHRcdFx0XHRcdGlmKGdsb2JhbFRlbXAgIT0gbnVsbCkgLy8g0LjRidC10Lwg0LIg0LPQu9C+0LHQsNC70YzQvdC+0Lwg0LzQsNGB0YHQuNCy0LUg0Lgg0LfQsNC/0YPRgdC60LDQtdC8INC+0LHRgNCw0LHQvtGC0LrRgyDQv9C+0LvRg9GH0LXQvdC90YvRhSDQuNC3INC90LXQs9C+INC00LDQvdC90YvRhVxyXG5cdFx0XHRcdFx0XHRwYXJzZURhdGEoZ2xvYmFsVGVtcCxkYXRhVHlwZVBhcmFtKTtcclxuXHJcblx0XHRcdFx0XHRlbHNlIC8vINC40L3QsNGH0LUg0LfQsNC/0YPRgdC60LDQtdC8INGE0YPQvdC60YbQuNGOINC30LDQs9GA0YPQt9C60Lgg0YEg0YHQtdGA0LLQtdGA0LBcclxuXHRcdFx0XHRcdFx0bG9hZERhdGFTZXJ2ZXIoZmFsc2UpOyBcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlIFwicHJlY2lwaXRhdGlvblwiOlxyXG5cdFx0XHRcdFx0aWYoZ2xvYmFsUHJlYyAhPSBudWxsKVxyXG5cdFx0XHRcdFx0XHRwYXJzZURhdGEoZ2xvYmFsUHJlYyxkYXRhVHlwZVBhcmFtKTtcclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0bG9hZERhdGFTZXJ2ZXIoZmFsc2UpO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHRsb2FkRGF0YVNlcnZlcihmYWxzZSk7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cdFx0XHJcblx0fVxyXG5cclxuXHQvL9GE0YPQvdC60YbQuNGPINC30LDQs9GA0YPQt9C60Lgg0LjQtyBJbmRleGVkREJcclxuXHRmdW5jdGlvbiBsb2FkSW5kZXhlZERiKGRhdGFUeXBlUGFyYW0pe1xyXG5cclxuXHRcdHZhciBnZXREYXRhO1xyXG5cdFx0dmFyIGluZGV4ZWREQiA9IHdpbmRvdy5pbmRleGVkREIgfHwgd2luZG93Lm1vekluZGV4ZWREQiB8fCB3aW5kb3cud2Via2l0SW5kZXhlZERCIHx8IHdpbmRvdy5tc0luZGV4ZWREQiB8fCB3aW5kb3cuc2hpbUluZGV4ZWREQjtcclxuXHRcdHZhciBvcGVuID0gaW5kZXhlZERCLm9wZW4oJ25ld0RhdGFiYXNlJywgMSk7XHJcblx0XHR2YXIgZGI7XHJcblx0XHR2YXIgc3RvcmU7XHJcblx0XHR2YXIgaW5kZXg7XHJcblx0XHR2YXIgdHJhbnM7XHJcblxyXG5cdFx0b3Blbi5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0ZGIgPSBvcGVuLnJlc3VsdDtcclxuXHRcdFx0c3RvcmUgPSBkYi5jcmVhdGVPYmplY3RTdG9yZSgnbmV3T2JqZWN0Jywge2tleVBhdGg6IFwiaWRcIn0pO1xyXG5cdFx0XHRpbmRleCA9IHN0b3JlLmNyZWF0ZUluZGV4KCduYW1lSW5kZXgnLCdkYXRhJyk7XHJcblx0XHR9O1xyXG5cclxuXHRcdG9wZW4ub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdGRiID0gb3Blbi5yZXN1bHQ7XHJcblx0XHRcdHRyYW5zID0gZGIudHJhbnNhY3Rpb24oJ25ld09iamVjdCcsICdyZWFkd3JpdGUnKTtcclxuXHRcdFx0c3RvcmUgPSB0cmFucy5vYmplY3RTdG9yZSgnbmV3T2JqZWN0Jyk7XHJcblx0XHRcdGluZGV4ID0gc3RvcmUuaW5kZXgoJ25hbWVJbmRleCcpO1xyXG5cclxuXHRcdFx0c3dpdGNoKGRhdGFUeXBlUGFyYW0pe1xyXG5cclxuXHRcdFx0XHRjYXNlIFwidGVtcGVyYXR1cmVcIjogLy8g0LXRgdC70Lgg0LrQu9GO0Ycg0YLQuNC/0LAg0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINC00LDQvdC90YvRhVxyXG5cdFx0XHRcdFx0Z2V0RGF0YSA9IHN0b3JlLmdldCgxKTsgLy8g0L/QvtC70YPRh9Cw0LXQvCDQvtCx0LXQutGCINC40LfQuCDQu9C+0LrQsNC70YzQvdC+0LPQviDRhdGA0LDQvdC40LvQuNGJ0LBcclxuXHJcblx0XHRcdFx0XHRnZXREYXRhLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYoZ2V0RGF0YVsncmVzdWx0J10gPT0gdW5kZWZpbmVkKXsgLy8g0LXRgdC70Lgg0L/QvtC70LUg0YEg0LTQsNC90L3Ri9C80Lgg0LIg0L7QsdGM0LXQutGC0LUgPT0gdW5kZWZpbmVkXHJcblxyXG5cdFx0XHRcdFx0XHRcdGxvYWREYXRhU2VydmVyKHRydWUpOyAvLyDQt9Cw0LPRgNGD0LbQsNC10Lwg0YEg0YHQtdGA0LLQtdGA0LAg0L/QvtC70L3Ri9C5IGpzb24g0YEg0LTQsNC90L3Ri9C80Lgg0L/QviDQstGL0LHRgNCw0L3QvdC+0LzRgyDRgtC40L/RgyDQtNCw0L3QvdGL0YVcclxuXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZXsgLy8g0LjQvdCw0YfQtSDQv9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0LTQsNC90L3Ri9GFINCyINCx0LDQt9C1INC/0L4g0YLQtdC60YPRidC10LzRgyDQt9Cw0L/RgNC+0YHRgyBcclxuXHJcblx0XHRcdFx0XHRcdFx0bGV0IGtleSA9IHllYXJzUGFyYW0gKyAnOicgKyBkYXRhVHlwZVBhcmFtO1xyXG5cdFx0XHRcdFx0XHRcdGxldCBxdWVyeSAgPSBzdG9yZS5nZXQoa2V5KTtcclxuXHJcblx0XHRcdFx0XHRcdFx0cXVlcnkub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0aWYoIHF1ZXJ5IFsncmVzdWx0J10gIT0gdW5kZWZpbmVkICYmIGtleSA9PSBxdWVyeSBbJ3Jlc3VsdCddWydpZCddKXsgLy8g0LXRgdC70Lgg0LTQsNC90L3Ri9C1INC/0L4g0YLQtdC60YPRidC10LzRgyDQt9Cw0L/RgNC+0YHRgyDQtdGB0YLRjCDQsiDQsdCw0LfQtVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlQ2FudmFzU2NoZWR1bGUocXVlcnkgWydyZXN1bHQnXVsnZGF0YSddKTsgLy8g0L/QtdGA0LXQtNCw0LXQvCDQvtCx0YzQtdC60YIg0LTQsNC90L3Ri9GFINC00LvRjyDQutC+0L3QutGA0LXRgtC90L7Qs9C+INGC0LXQutGD0YnQtdCz0L4g0LfQsNC/0YDQvtGB0LAg0LIg0YTRg9C90LrRhtC40Y4g0L/QvtGB0YLRgNC+0LXQvdC40Y8g0YLQsNCx0LvQuNGGXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0XHRlbHNleyAvLyDQuNC90LDRh9C1INC/0L7Qu9GD0YfQsNC10Lwg0L/QvtC70L3Ri9C5IGpzb24g0LjQtyDQsdCw0LfRiyDQuCDQv9C10YDQtdC00LDQtdC8INC90LAg0L/RgNC+0YHRh9C10YIg0L/QviDRgtC10LrRg9GJ0LXQvNGDINC30LDQv9GA0L7RgdGDXHJcblx0XHRcdFx0XHRcdFx0XHRcdHBhcnNlRGF0YShnZXREYXRhWydyZXN1bHQnXVsnZGF0YSddLGRhdGFUeXBlUGFyYW0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCAgIFx0XHRcdFx0ICAgICAgIFxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlIFwicHJlY2lwaXRhdGlvblwiOlxyXG5cdFx0XHRcdFx0Z2V0RGF0YSA9IHN0b3JlLmdldCgyKTtcclxuXHJcblx0XHRcdFx0XHRnZXREYXRhLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYoZ2V0RGF0YVsncmVzdWx0J10gPT0gdW5kZWZpbmVkKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0bG9hZERhdGFTZXJ2ZXIodHJ1ZSk7XHJcblxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGVsc2V7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0bGV0IGtleSA9IHllYXJzUGFyYW0gKyAnOicgKyBkYXRhVHlwZVBhcmFtO1xyXG5cdFx0XHRcdFx0XHRcdGxldCBxdWVyeSA9IHN0b3JlLmdldChrZXkpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRxdWVyeS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRpZiggcXVlcnkgWydyZXN1bHQnXSAhPSB1bmRlZmluZWQgJiYga2V5ID09IHF1ZXJ5IFsncmVzdWx0J11bJ2lkJ10pe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0Y3JlYXRlQ2FudmFzU2NoZWR1bGUocXVlcnkgWydyZXN1bHQnXVsnZGF0YSddKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRcdGVsc2V7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHBhcnNlRGF0YShnZXREYXRhWydyZXN1bHQnXVsnZGF0YSddLGRhdGFUeXBlUGFyYW0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCAgIFx0XHRcdFx0ICAgICAgIFxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0bG9hZERhdGFTZXJ2ZXIodHJ1ZSk7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0dHJhbnMub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdFx0XHRkYi5jbG9zZSgpO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvL9GE0YPQvdC60YbQuNGPINC00L7QsdCw0LLQu9C10L3QuNGPINCyIEluZGV4ZWREQiDQv9C+0LvQvdGL0YUg0LTQsNC90L3Ri9GFINC/0L4g0YLQuNC/0YMg0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINC00LDQvdC90YvRhVxyXG5cdGZ1bmN0aW9uIGFkZEluZGV4ZWREYihkYXRhKXtcclxuXHJcblx0XHR2YXIgZ2V0RGF0YTtcclxuXHRcdHZhciBpbmRleGVkREIgPSB3aW5kb3cuaW5kZXhlZERCIHx8IHdpbmRvdy5tb3pJbmRleGVkREIgfHwgd2luZG93LndlYmtpdEluZGV4ZWREQiB8fCB3aW5kb3cubXNJbmRleGVkREIgfHwgd2luZG93LnNoaW1JbmRleGVkREI7XHJcblx0XHR2YXIgb3BlbiA9IGluZGV4ZWREQi5vcGVuKCduZXdEYXRhYmFzZScsIDEpO1xyXG5cdFx0dmFyIGRiO1xyXG5cdFx0dmFyIHN0b3JlO1xyXG5cdFx0dmFyIGluZGV4O1xyXG5cdFx0dmFyIHRyYW5zO1xyXG5cclxuXHRcdG9wZW4ub251cGdyYWRlbmVlZGVkID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdGRiID0gb3Blbi5yZXN1bHQ7XHJcblx0XHRcdHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoJ25ld09iamVjdCcsIHtrZXlQYXRoOiBcImlkXCJ9KTtcclxuXHRcdFx0aW5kZXggPSBzdG9yZS5jcmVhdGVJbmRleCgnbmFtZUluZGV4JywnZGF0YScpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRvcGVuLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRkYiA9IG9wZW4ucmVzdWx0O1xyXG5cdFx0XHR0cmFucyA9IGRiLnRyYW5zYWN0aW9uKCduZXdPYmplY3QnLCAncmVhZHdyaXRlJyk7XHJcblx0XHRcdHN0b3JlID0gdHJhbnMub2JqZWN0U3RvcmUoJ25ld09iamVjdCcpO1xyXG5cdFx0XHRpbmRleCA9IHN0b3JlLmluZGV4KCduYW1lSW5kZXgnKTtcclxuXHJcblx0XHRcdGlmKGRhdGFUeXBlUGFyYW0gPT0gJ3RlbXBlcmF0dXJlJyl7IC8vINC10YHQu9C4INC60LvRjtGHINGC0LjQv9CwINC+0YLQvtCx0YDQsNC20LDQtdC80YvRhSDQtNCw0L3QvdGL0YVcclxuXHJcblx0XHRcdFx0c3RvcmUucHV0KHtpZDogMSwgZGF0YTogZGF0YX0pOyAvLyDQt9Cw0L/QuNGB0Ywg0LTQsNC90L3Ri9GFINC/0L7Qu9C90L7Qs9C+INC+0LHRjNC10LrRgtCwIGpzb24g0L/QviDRgtC40L/RgyDQt9Cw0L/RgNCw0YjQuNCy0LDQtdC80YvRhSDQtNCw0L3QvdGL0YUg0LIgZGJcclxuXHRcdFx0XHRnZXREYXRhID0gc3RvcmUuZ2V0KDEpOyAvLyDQv9C+0LvRg9GH0LXQvdC40LUg0LjQtyBkYiDQvtCx0LXQutGC0LAg0YEg0LTQsNC90L3Ri9C80LhcclxuXHJcblx0XHRcdFx0Z2V0RGF0YS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0XHRcdFx0XHRwYXJzZURhdGEoZ2V0RGF0YVsncmVzdWx0J11bJ2RhdGEnXSxkYXRhVHlwZVBhcmFtKTsgLy8g0L7RgtC/0YDQsNCy0LrQsCDQvtCx0YzQtdC60YLQsCDRgSDQtNCw0L3QvdGL0LzQuCDQuCDQuNC90YLQtdGA0LLQsNC70LAg0LTQsNGCINCyINGE0YPQvdC60YbQuNGOINC/0YDQvtGB0YfQtdGC0LBcclxuXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmKGRhdGFUeXBlUGFyYW0gPT0gJ3ByZWNpcGl0YXRpb24nKXtcclxuXHJcblx0XHRcdFx0c3RvcmUucHV0KHtpZDogMiwgZGF0YTogZGF0YX0pO1xyXG5cdFx0XHRcdGdldERhdGEgPSBzdG9yZS5nZXQoMik7XHJcblxyXG5cdFx0XHRcdGdldERhdGEub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0XHRcdFx0cGFyc2VEYXRhKGdldERhdGFbJ3Jlc3VsdCddWydkYXRhJ10sZGF0YVR5cGVQYXJhbSk7XHJcblxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cmFucy5vbmNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0ZGIuY2xvc2UoKTtcclxuXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly/RhNGD0L3QutGG0LjRjyDQtNC+0LHQsNCy0LvQtdC90LjRjyDQsiBJbmRleGVkREIg0LTQsNC90L3Ri9GFINC/0L4g0YLQuNC/0YMg0Lgg0LrQvtC90LrRgNC10YLQvdC+0LzRgyDQuNC90YLQtdGA0LLQsNC70YMg0L7RgtC+0LHRgNCw0LbQsNC10LzRi9GFINC00LDQvdC90YvRhVxyXG5cdGZ1bmN0aW9uIGFkZEluRGJOZXdPYmplY3Qob2JqKXtcclxuXHJcblx0XHR2YXIgZ2V0RGF0YTtcclxuXHRcdHZhciBpbmRleGVkREIgPSB3aW5kb3cuaW5kZXhlZERCIHx8IHdpbmRvdy5tb3pJbmRleGVkREIgfHwgd2luZG93LndlYmtpdEluZGV4ZWREQiB8fCB3aW5kb3cubXNJbmRleGVkREIgfHwgd2luZG93LnNoaW1JbmRleGVkREI7XHJcblx0XHR2YXIgb3BlbiA9IGluZGV4ZWREQi5vcGVuKCduZXdEYXRhYmFzZScsIDEpO1xyXG5cdFx0dmFyIGRiO1xyXG5cdFx0dmFyIHN0b3JlO1xyXG5cdFx0dmFyIGluZGV4O1xyXG5cdFx0dmFyIHRyYW5zO1xyXG5cclxuXHRcdG9wZW4ub251cGdyYWRlbmVlZGVkID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdGRiID0gb3Blbi5yZXN1bHQ7XHJcblx0XHRcdHN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoJ25ld09iamVjdCcsIHtrZXlQYXRoOiBcImlkXCJ9KTtcclxuXHRcdFx0aW5kZXggPSBzdG9yZS5jcmVhdGVJbmRleCgnbmFtZUluZGV4JywnZGF0YScpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRvcGVuLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRkYiA9IG9wZW4ucmVzdWx0O1xyXG5cdFx0XHR0cmFucyA9IGRiLnRyYW5zYWN0aW9uKCduZXdPYmplY3QnLCAncmVhZHdyaXRlJyk7XHJcblx0XHRcdHN0b3JlID0gdHJhbnMub2JqZWN0U3RvcmUoJ25ld09iamVjdCcpO1xyXG5cdFx0XHRpbmRleCA9IHN0b3JlLmluZGV4KCduYW1lSW5kZXgnKTtcclxuXHRcdFx0a2V5ID0gb2JqWydwZXJpb2QnXSArJzonKyBvYmpbJ2RhdGFUeXBlJ11cclxuXHRcdFx0c3RvcmUucHV0KHtpZDoga2V5LCBkYXRhOiBvYmp9KTsgLy8g0LfQsNC/0LjRgdGMINC+0LHQtdC60YLQsCDQv9GA0L7RgdGH0LjRgtCw0L3QvdGL0YUg0LTQsNC90L3Ri9GFINGBINGC0LXQutGD0YjQtdCz0L4g0LfQsNC/0YDQvtGB0LAg0L/QviDRg9C60LDQt9Cw0L3QvdC+0LzRgyDQuNC90YLQtdGA0LLQsNC70YMg0LIgZGJcclxuXHRcdFx0Z2V0RGF0YSA9IHN0b3JlLmdldChrZXkpO1xyXG5cclxuXHRcdFx0dHJhbnMub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGRiLmNsb3NlKCk7XHJcblxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8g0YTRg9C90LrRhtC40Y8g0LfQsNCz0YDRg9C30LrQuCDQtNCw0L3QvdGL0YUg0YEg0YHQtdGA0LLQtdGA0LBcclxuXHRmdW5jdGlvbiBsb2FkRGF0YVNlcnZlcihpc0luZGV4RGIpIHtcclxuXHJcblx0XHQvL9C+0YLQvtCx0YDQsNC20LXQvdC40LUg0L/RgNC10LvQvtCw0LTQtdGA0LBcclxuXHRcdGNhbnZhc0JveFswXS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMDstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7Jyk7XHJcblx0XHRwcmVsb2FkZXJbMF0uc2V0QXR0cmlidXRlKCdzdHlsZScsJ29wYWNpdHk6IDE7LXdlYmtpdC10cmFuc2l0aW9uOiBhbGwgMC4zczstby10cmFuc2l0aW9uOiBhbGwgMC4zczstbW96LXRyYW5zaXRpb246IGFsbCAwLjNzOycpO1xyXG5cclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpeyAvL1xyXG5cclxuXHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG5cclxuXHRcdFx0eGhyLm9wZW4oJ0dFVCcsICdsaWJzLycrIGRhdGFUeXBlUGFyYW0gKycuanNvbicsIHRydWUpO1xyXG5cclxuXHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPSA0KSByZXR1cm47XHJcblxyXG5cdFx0XHRcdGlmICh4aHIuc3RhdHVzICE9IDIwMCkge1xyXG5cclxuXHRcdFx0XHRcdHJlamVjdChjb25zb2xlLmxvZygnc2VydmVyLWVycm9yIScpKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHZhciBkYXRhID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR9IFxyXG5cdFx0XHRcdFx0Y2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRcdFx0YWxlcnQoIFwi0KfRgtC+INGC0L4g0L/QvtGI0LvQviDQvdC1INGC0LDQuiEg0J/QvtC/0YDQvtCx0YPQudGC0LUg0L/QvtCy0YLQvtGA0LjRgtGMINC/0L7Qv9GL0YLQutGDINC/0L7Qt9C00L3QtdC1IHx8XCIgICsgZS5tZXNzYWdlICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYoaXNJbmRleERiID09IHRydWUpeyAvLyDQtdGB0LvQuCBpbmRleGVkRGJcclxuXHJcblx0XHRcdFx0XHRcdGlmKGRhdGFUeXBlUGFyYW0gPT0gJ3RlbXBlcmF0dXJlJyB8fCBkYXRhVHlwZVBhcmFtID09ICdwcmVjaXBpdGF0aW9uJyl7XHJcblx0XHRcdFx0XHRcdFx0YWRkSW5kZXhlZERiKGRhdGEpOyAvLyDQv9C10YDQtdC00LDRh9CwINC30LDQs9GA0YPQttC10L3QvdGL0YUg0LTQsNC90L3Ri9GFINCyINGE0YPQvdC60YbQuNGOINC30LDQv9C40YHQuCDQsiBkYlxyXG5cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVsc2V7IC8vINC40L3QsNGH0LUg0LfQsNC/0LjRgdGMINC/0L7Qu9GD0YfQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQsiDQs9C70L7QsdCw0LvRjNC90YvQuSDQvNCw0YHRgdC40LJcclxuXHJcblx0XHRcdFx0XHRcdGlmKGRhdGFUeXBlUGFyYW0gPT0gJ3RlbXBlcmF0dXJlJyl7XHJcblx0XHRcdFx0XHRcdFx0Z2xvYmFsVGVtcCA9IGRhdGE7XHJcblx0XHRcdFx0XHRcdFx0cGFyc2VEYXRhKGdsb2JhbFRlbXAsZGF0YVR5cGVQYXJhbSk7IC8vINC/0LXRgNC10LTQsNGH0LAg0LfQsNCz0YDRg9C20LXQvdC90YvRhSDQtNCw0L3QvdGL0YUg0LIg0YTRg9C90LrRhtC40Y4g0L/RgNC+0YHRh9C10YLQsCDQtNCw0L3QvdGL0YVcclxuXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYoZGF0YVR5cGVQYXJhbSA9PSAncHJlY2lwaXRhdGlvbicpe1xyXG5cdFx0XHRcdFx0XHRcdGdsb2JhbFByZWMgPSBkYXRhO1xyXG5cdFx0XHRcdFx0XHRcdHBhcnNlRGF0YShnbG9iYWxQcmVjLGRhdGFUeXBlUGFyYW0pO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8g0YHQutGA0YvRgtC40LUg0L/RgNC10LvQvtCw0LTQtdGA0LBcclxuXHRcdFx0XHRcdHJlc29sdmUoKGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0XHRcdGNhbnZhc0JveFswXS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMTstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7Jyk7XHJcblx0XHRcdFx0XHRcdHByZWxvYWRlclswXS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMDstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7Jyk7XHJcblx0XHRcdFx0XHR9KSgpKTtcclxuXHRcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR4aHIuc2VuZCgpO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvLyDRhNGD0L3QutGG0LjRjyDQv9GA0L7RgdGH0LXRgtCwINC00LDQvdC90YvRhVxyXG5cdGZ1bmN0aW9uIHBhcnNlRGF0YShkYXRhLGRhdGFUeXBlUGFyYW0pIHtcclxuXHJcblx0XHR2YXIgYXJyWWVhcnMgPSBbXTsvLyDQvNCw0YHRgdC40LIg0L7QsdGJ0LXQs9C+INC60L7Quy3QstCwINC00LDRglxyXG5cdFx0dmFyIGluZGV4TG9hZDtcclxuXHRcdHZhciBpbmRleExvYWRZZWFyO1xyXG5cdFx0XHJcblxyXG5cdFx0Ly9jb25zb2xlLmxvZyhkYXRhKTtcclxuXHJcblx0XHRmb3IobGV0IGkgPSAwOyBpPGRhdGEubGVuZ3RoIC0gMTsgaSsrKXtcclxuXHJcblx0XHRcdGlmKGRhdGFbaV1bJ3QnXS5zcGxpdCgnLScpWzBdID09IGRhdGFbaSsxXVsndCddLnNwbGl0KCctJylbMF0gJiYgZGF0YVtpKzFdICE9IGRhdGFbZGF0YS5sZW5ndGggLSAxXSlcclxuXHRcdFx0IFx0Y29udGludWVcclxuXHJcblx0XHRcdGFyclllYXJzLnB1c2goZGF0YVtpXVsndCddLnNwbGl0KCctJylbMF0pO1xyXG5cdFx0XHRcclxuXHRcdH1cclxuXHJcblx0XHRmb3IobGV0IGkgPSAwOyBpIDwgc2VsZWN0RWxlbS5sZW5ndGg7IGkrKyl7IC8vINCy0YvQstC+0LQg0LTQsNGCINCyIHNlbGVjdCDRg9GB0YLQsNC90L7QstC60LAg0LrQu9GO0YfQtdC5INCyINCw0YLRgNC40LHRg9GC0Ysg0Lgg0L/QvtC70YPRh9C10L3QuNC1INC30L3QsNGH0LXQvdC40Lkg0LjQtyBvcHRpb25cclxuXHRcdFx0c2VsZWN0RWxlbVtpXSA9IGFkZE9wdGlvbnNMaXN0LmNhbGwoc2VsZWN0RWxlbVtpXSxhcnJZZWFycyxzZWxlY3RFbGVtW2ldLmdldEF0dHJpYnV0ZSgnb3B0aW9uLWxpc3QnKSk7XHJcblx0XHRcdGluZGV4TG9hZCA9IHNlbGVjdEVsZW1baV0ub3B0aW9ucy5zZWxlY3RlZEluZGV4O1xyXG5cdFx0XHRpbmRleExvYWRZZWFyID0gc2VsZWN0RWxlbVtpXS5vcHRpb25zW2luZGV4TG9hZF0udmFsdWU7XHJcblx0XHRcdHNlbGVjdEVsZW1baV0uc2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJyxpbmRleExvYWRZZWFyKTtcclxuXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGlmKHdpbmRvdy5Xb3JrZXIpIHsgLy8g0LXRgdC70Lgg0L/QvtC00LTQtdGA0LbQuNCy0LDQtdGC0YHRjyDQvtCx0YzQtdC60YIgd29ya2VyXHJcblxyXG5cdFx0XHRsZXQgb2JqID0ge307XHJcblx0XHRcdGxldCB3b3JrZXI7XHJcblx0XHRcdGxldCBlcnJvck9iaiA9IHt9O1xyXG5cclxuXHRcdFx0aWYocGFyc2VJbnQoZ2V0WWVhcnNJbnRlcnZhbCgpLnNwbGl0KCctJylbMF0pID4gcGFyc2VJbnQoZ2V0WWVhcnNJbnRlcnZhbCgpLnNwbGl0KCctJylbMV0pKXsgLy8g0LXRgdC70Lgg0LTQsNGC0LAg0LjQtyDQv9C10YDQstC+0LPQviDRgdC10LvQtdC60YLQsCDQsdC+0LvRjNGI0LUg0LTQsNGC0Ysg0LjQtyDQstGC0L7RgNC+0LPQvlxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiB0b3RhbE9iamVjdCh5ZWFycyxkYXRhVHlwZVBhcmFtKXsgLy8g0YHQvtC30LTQsNC90LjQtSDQvtCx0YzQtdC60YLQsCDQutC+0L3QtdGH0L3Ri9GFINC00LDQvdC90YvRhSDRgSDQv9C+0LvQtdC8INC+0YjQuNCx0LrQuFxyXG5cclxuXHRcdFx0XHRcdHRoaXMub2JqZWN0VHlwZSA9ICd0b3RhbFNjaGVkdWxlJztcclxuXHRcdFx0XHRcdHRoaXMuZGF0YVR5cGUgPSBkYXRhVHlwZVBhcmFtO1x0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR0aGlzLnBlcmlvZCA9IHllYXJzO1xyXG5cdFx0XHRcdFx0dGhpcy5lcnJvckRhdGEgPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlcnJvck9iaiA9IG5ldyB0b3RhbE9iamVjdChnZXRZZWFyc0ludGVydmFsKCksZGF0YVR5cGVQYXJhbSk7XHJcblx0XHRcdFx0Y3JlYXRlQ2FudmFzU2NoZWR1bGUoZXJyb3JPYmopOyAvL9C/0LXRgNC10LTQsNGH0LAg0L7QsdC10LrRgtCwINCyINGE0YPQvdC60YbQuNGOINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0YLQsNCx0LvQuNGGXHJcblxyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2V7IC8vINC40L3QsNGH0LUg0L/QtdGA0LXQtNCw0YfQsCDQt9Cw0LPRgNGD0LbQtdC90L3Ri9GFINGBINGB0LXRgNCy0LXRgNCwINC00LDQvdC90YvRhSDQuCDRg9GB0YLQsNC90L7QstC70LXQvdC90L7Qs9C+INC40L3RgtC10YDQstCw0LvQsCDQsiB3b3JrZXIg0LTQu9GPINC/0YDQvtGB0YfQtdGC0LBcclxuXHJcblx0XHRcdFx0b2JqLmRhdGEgICAgID0gZGF0YTtcclxuXHRcdFx0XHRvYmouaW50ZXJ2YWwgPSBnZXRZZWFyc0ludGVydmFsKCk7XHJcblx0XHRcdFx0b2JqLnBhcmFtICAgID0gZGF0YVR5cGVQYXJhbTtcclxuXHJcblx0XHRcdFx0d29ya2VyID0gbmV3IFdvcmtlcignbGlicy93b3JrZXJzL2NhbGN1bGF0aW9uLmpzJyk7XHJcblx0XHRcdFx0Ly/Qv9C70LXQu9C+0LDQtNC10YAg0LTQviDQv9GA0L7RgdGH0LXRgtCwINC00LDQvdC90YvRhVxyXG5cdFx0XHRcdGNhbnZhcy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMDstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7Jyk7XHJcblx0XHRcdFx0cHJlbG9hZGVyWzBdLnNldEF0dHJpYnV0ZSgnc3R5bGUnLCdvcGFjaXR5OiAxOy13ZWJraXQtdHJhbnNpdGlvbjogYWxsIDAuM3M7LW8tdHJhbnNpdGlvbjogYWxsIDAuM3M7LW1vei10cmFuc2l0aW9uOiBhbGwgMC4zczt6LWluZGV4Ojk5OycpO1xyXG5cdFx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShvYmopO1xyXG5cclxuXHRcdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpe1xyXG5cclxuXHRcdFx0XHRcdC8vINGB0LrRgNGL0YLQuNC1INC/0YDQtdC70L7QsNC00LXRgNCwINC/0L7RgdC70LVcclxuXHRcdFx0XHRcdHByZWxvYWRlclswXS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMDstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7ei1pbmRleDotMTsnKTtcclxuXHRcdFx0XHRcdGNhbnZhcy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywnb3BhY2l0eTogMTstd2Via2l0LXRyYW5zaXRpb246IGFsbCAwLjNzOy1vLXRyYW5zaXRpb246IGFsbCAwLjNzOy1tb3otdHJhbnNpdGlvbjogYWxsIDAuM3M7Jyk7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGNyZWF0ZUNhbnZhc1NjaGVkdWxlKGV2ZW50WydkYXRhJ10pOy8vINC/0LXRgNC10LTQsNGH0LAg0YHRhNC+0YDQvNC40YDQvtCy0LDQvdC90L7Qs9C+INC/0L7RgdC70LUg0L/RgNC+0YHRh9C10YLQsCDQvtCx0LXQutGC0LAg0YEg0LTQsNC90L3Ri9C80Lgg0L/QvtC80LXRgdGP0YfQvdC+XHJcblx0XHRcdFx0XHRhZGRJbkRiTmV3T2JqZWN0KGV2ZW50WydkYXRhJ10pOyAvLyDQt9Cw0L/QuNGB0Ywg0L7QsdC10LrRgtCwINCyIGluZGV4ZWQgRGIgXHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGVsc2V7IC8vINC40L3QsNGH0LUg0L/RgNC+0YHRh9C10YIg0LTQsNC90L3Ri9GFINCyINC+0YHQvdC+0LLQvdC+0Lwg0L/QvtGC0L7QutC1INCyINGE0YPQvdC60YbQuNC4IHBhcnNlWWVhckRhdGEoKVxyXG5cclxuXHRcdFx0aWYocGFyc2VJbnQoZ2V0WWVhcnNJbnRlcnZhbCgpLnNwbGl0KCctJylbMF0pID4gcGFyc2VJbnQoZ2V0WWVhcnNJbnRlcnZhbCgpLnNwbGl0KCctJylbMV0pKXtcclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gdG90YWxPYmplY3QoeWVhcnMsZGF0YVR5cGVQYXJhbSl7XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5vYmplY3RUeXBlID0gJ3RvdGFsU2NoZWR1bGUnO1xyXG5cdFx0XHRcdFx0dGhpcy5kYXRhVHlwZSA9IGRhdGFUeXBlUGFyYW07XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdHRoaXMucGVyaW9kID0geWVhcnM7XHJcblx0XHRcdFx0XHR0aGlzLmVycm9yRGF0YSA9IHRydWU7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGVycm9yT2JqID0gbmV3IHRvdGFsT2JqZWN0KGdldFllYXJzSW50ZXJ2YWwoKSxkYXRhVHlwZVBhcmFtKTtcclxuXHRcdFx0XHRjcmVhdGVDYW52YXNTY2hlZHVsZShlcnJvck9iaik7XHJcblxyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2V7XHJcblx0XHRcdFx0cGFyc2VZZWFyRGF0YShkYXRhLGdldFllYXJzSW50ZXJ2YWwoKSxkYXRhVHlwZVBhcmFtKTtcclxuXHRcdFx0fVxyXG5cdFx0fVx0XHRcclxuXHR9XHJcblxyXG5cdC8v0L/RgNC+0YHRh9C10YIg0L/QvtC70YPRh9C10L3QvdGL0YUg0LTQsNC90L3Ri9GFINC10YHQu9C4INC90LXRgiDQv9C+0LTQtNC10YDQttC60Lggd29ya2VyXHJcblx0ZnVuY3Rpb24gcGFyc2VZZWFyRGF0YShkYXRhLHllYXJzLGRhdGFUeXBlUGFyYW0pe1xyXG5cdFx0dmFyIHRvcFllYXIgPSBwYXJzZUludCh5ZWFycy5zcGxpdCgnLScpWzBdKTtcclxuXHRcdHZhciBib3R0WWVhciA9IHBhcnNlSW50KHllYXJzLnNwbGl0KCctJylbMV0pO1xyXG5cdFx0dmFyIGNvdW50WWVhcnMgPSBib3R0WWVhciAtIHRvcFllYXIgKyAxO1xyXG5cdFx0dmFyIHN1bSA9IFtdO1xyXG5cdFx0dmFyIHRvdGFsTWV0ZW9EYXRhO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHRvdGFsT2JqZWN0KHllYXJzLGRhdGFUeXBlUGFyYW0pe1xyXG5cclxuXHRcdFx0dGhpcy5vYmplY3RUeXBlID0gJ3RvdGFsU2NoZWR1bGUnO1xyXG5cdFx0XHR0aGlzLmRhdGFUeXBlID0gZGF0YVR5cGVQYXJhbTtcclxuXHRcdFx0dGhpcy5wZXJpb2QgPSB5ZWFycztcclxuXHRcdFx0XHJcblx0XHR9XHJcblxyXG5cdFx0aWYodG9wWWVhciA8PSBib3R0WWVhciApe1xyXG5cdFx0XHRmb3IobGV0IGkgPSAwOyBpPD0gZGF0YS5sZW5ndGgtMTsgaSsrKXtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZihwYXJzZUludChkYXRhW2ldWyd0J10uc3BsaXQoJy0nKVswXSkgPj0gdG9wWWVhciAmJiBwYXJzZUludChkYXRhW2ldWyd0J10uc3BsaXQoJy0nKVswXSkgPD0gYm90dFllYXIpXHJcblx0XHRcdFx0XHRzdW0ucHVzaChkYXRhW2ldKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZ1bmN0aW9uIGVhY2hNb250aChhcnIsbW9udGgsY291bnRZZWFycyl7XHJcblxyXG5cdFx0XHRcdHZhciB0b3RhbERheXMgPSBbXTtcclxuXHRcdFx0XHR2YXIgcmVzdWx0UmV0dXJuO1xyXG5cdFx0XHRcdHZhciByZXN1bHQ7XHJcblx0XHRcdFx0dmFyIHRvdGFsID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yKGxldCBpID0gMDsgaTxhcnIubGVuZ3RoIC0gMTsgaSsrKXtcclxuXHJcblx0XHRcdFx0XHRpZihhcnJbaV1bJ3QnXS5zcGxpdCgnLScpWzFdID09IG1vbnRoKXtcclxuXHJcblx0XHRcdFx0XHQgXHR0b3RhbERheXMucHVzaChhcnJbaV1bJ3YnXSk7XHJcblx0XHRcdFx0XHQgXHR0b3RhbCsrO1xyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzdWx0ID0gdG90YWxEYXlzLnJlZHVjZShmdW5jdGlvbihzdW1OZXh0LCBjdXJyZW50KSB7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gc3VtTmV4dCArIGN1cnJlbnQ7XHJcblxyXG5cdFx0XHRcdH0sIDApO1xyXG5cclxuXHRcdFx0XHRyZXN1bHRSZXR1cm4gPSBwYXJzZUZsb2F0KHJlc3VsdC50b0ZpeGVkKDEpKS90b3RhbFxyXG5cclxuXHRcdFx0XHRyZXR1cm4gcGFyc2VGbG9hdChyZXN1bHRSZXR1cm4udG9GaXhlZCgxKSk7XHJcblx0XHRcdH1cclxuXHRcdFxyXG5cclxuXHRcdFx0dG90YWxPYmplY3QucHJvdG90eXBlLmFkZE1vbnRoID0gZnVuY3Rpb24oc3VtLGNvdW50WWVhcnMpe1xyXG5cclxuXHRcdFx0XHR0aGlzWyd0b3RhbEphbnVhcnktMDEnXSAgID0gZWFjaE1vbnRoKHN1bSwnMDEnLGNvdW50WWVhcnMpO1xyXG5cdFx0XHRcdHRoaXNbJ3RvdGFsRmVicnVhcnktMDInXSAgPSBlYWNoTW9udGgoc3VtLCcwMicsY291bnRZZWFycyk7XHJcblx0XHRcdFx0dGhpc1sndG90YWxNYXJjaC0wMyddIFx0ICA9IGVhY2hNb250aChzdW0sJzAzJyxjb3VudFllYXJzKTtcclxuXHRcdFx0XHR0aGlzWyd0b3RhbEFwcmlsLTA0J10gXHQgID0gZWFjaE1vbnRoKHN1bSwnMDQnLGNvdW50WWVhcnMpO1xyXG5cdFx0XHRcdHRoaXNbJ3RvdGFsTWF5LTA1J10gXHQgID0gZWFjaE1vbnRoKHN1bSwnMDUnLGNvdW50WWVhcnMpO1xyXG5cdFx0XHRcdHRoaXNbJ3RvdGFsSnVuZS0wNiddICAgICAgPSBlYWNoTW9udGgoc3VtLCcwNicsY291bnRZZWFycyk7XHJcblx0XHRcdFx0dGhpc1sndG90YWxKdWx5LTA3J10gXHQgID0gZWFjaE1vbnRoKHN1bSwnMDcnLGNvdW50WWVhcnMpO1xyXG5cdFx0XHRcdHRoaXNbJ3RvdGFsQXVndXN0LTA4J10gICAgPSBlYWNoTW9udGgoc3VtLCcwOCcsY291bnRZZWFycyk7XHJcblx0XHRcdFx0dGhpc1sndG90YWxTZXB0ZW1iZXItMDknXSA9IGVhY2hNb250aChzdW0sJzA5Jyxjb3VudFllYXJzKTtcclxuXHRcdFx0XHR0aGlzWyd0b3RhbE9jdG9iZXItMTAnXSAgID0gZWFjaE1vbnRoKHN1bSwnMTAnLGNvdW50WWVhcnMpO1xyXG5cdFx0XHRcdHRoaXNbJ3RvdGFsTm92ZW1iZXItMTEnXSAgPSBlYWNoTW9udGgoc3VtLCcxMScsY291bnRZZWFycyk7XHJcblx0XHRcdFx0dGhpc1sndG90YWxEZWNlbWJlci0xMiddICA9IGVhY2hNb250aChzdW0sJzEyJyxjb3VudFllYXJzKTtcclxuXHRcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0dG90YWxNZXRlb0RhdGEgPSBuZXcgdG90YWxPYmplY3QoeWVhcnMsZGF0YVR5cGVQYXJhbSk7XHJcblx0XHRcdHRvdGFsTWV0ZW9EYXRhLmFkZE1vbnRoKHN1bSxjb3VudFllYXJzKTtcclxuXHRcdFx0Y29uc29sZS5sb2codG90YWxNZXRlb0RhdGEpO1xyXG5cdFx0XHRjcmVhdGVDYW52YXNTY2hlZHVsZSh0b3RhbE1ldGVvRGF0YSk7XHJcblx0XHRcdFx0XHJcblx0XHR9XHJcblx0XHRlbHNle1xyXG5cclxuXHRcdFx0dG90YWxPYmplY3QucHJvdG90eXBlLmFkZEVycm9yRGF0YSA9IGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHRcdHRoaXMuZXJyb3JEYXRhID0gdHJ1ZTtcdFx0XHRcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dG90YWxNZXRlb0RhdGEuYWRkRXJyb3JEYXRhKCk7XHJcblx0XHRcdGNyZWF0ZUNhbnZhc1NjaGVkdWxlKHRvdGFsTWV0ZW9EYXRhKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly/RhNGD0L3QutGG0LjRjyDRgdC+0LfQtNCw0L3QuNGPINGC0LDQsdC70LjRhtGLIFxyXG5cdGZ1bmN0aW9uIGNyZWF0ZUNhbnZhc1NjaGVkdWxlKG9iail7XHJcblxyXG5cdFx0Y29uc29sZS5sb2cob2JqKVxyXG5cclxuXHRcdHRvdGFsTWV0ZW9EdGFPYmplY3QgPSBvYmo7XHJcblxyXG5cdFx0dmFyIHRpdGxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNhbnZhcy10aXRsZScpO1xyXG5cdFx0dmFyIHR5cGU7XHJcblxyXG5cdFx0aWYob2JqWydkYXRhVHlwZSddID09ICd0ZW1wZXJhdHVyZScpXHJcblx0XHRcdHR5cGUgPSAn0KLQtdC80L/QtdGA0LDRgtGD0YDQsCc7XHJcblx0XHRpZihvYmpbJ2RhdGFUeXBlJ10gPT0gJ3ByZWNpcGl0YXRpb24nKVxyXG5cdFx0XHR0eXBlID0gJ9Ce0YHQsNC00LrQuCc7XHJcblx0XHRcclxuXHRcdFxyXG5cdFx0Ly/QstC10YHQu9C4INC/0L7Qu9C1INGBINC+0YjQuNCx0LrQvtC5INCy0YvQstC+0LQg0YHQvtC+0LHRidC10L3QuNC1INC+0LEg0L3QtdCy0LXRgNC90L4g0LLQstC10LTQtdC90L3Ri9GFINC00LDQvdC90YvRhSDQuCDQvtGC0YfQuNGB0YLQutCwINGF0L7Qu9GB0YLQsFxyXG5cdFx0aWYob2JqWydlcnJvckRhdGEnXSl7XHJcblx0XHJcblx0XHRcdGN0eC5jbGVhclJlY3QoMCwgMCwgODUwLCA1NTApO1xyXG5cclxuXHRcdFx0dGl0bGVbMF0uY2xhc3NMaXN0LmFkZCgnb24tZXJyb3InKTtcclxuXHRcdFx0dGl0bGVbMF0uaW5uZXJIVE1MID0gJ9Cd0LXQu9GM0LfRjyDQvtGC0L7QsdGA0LDQt9C40YLRjCDQtNCw0L3QvdGL0LUg0LfQsCDQstGL0LHRgNCw0L3QvdGL0Lkg0L/QtdGA0LjQvtC0ISc7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8v0LLRi9Cy0L7QtCDQt9Cw0LPQvtC70L7QstC60LAg0YEg0YPQutCw0LfQsNC90LjQtdC8INC+0YLQvtCx0YDQsNC20LDQtdC80YvRhSDQtNCw0L3QvdGL0YVcclxuXHRcdGlmKCFvYmpbJ2Vycm9yRGF0YSddICYmIG9ialsncGVyaW9kJ10uc3BsaXQoJy0nKVswXSA9PSBvYmpbJ3BlcmlvZCddLnNwbGl0KCctJylbMV0pe1xyXG5cclxuXHRcdFx0dGl0bGVbMF0uY2xhc3NMaXN0LnJlbW92ZSgnb24tZXJyb3InKTtcclxuXHRcdFx0dGl0bGVbMF0uaW5uZXJIVE1MID0gJycrIHR5cGUgKycg0LfQsCAnKyBvYmpbJ3BlcmlvZCddLnNwbGl0KCctJylbMF0gKycg0LPQvtC0JztcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0aWYoIW9ialsnZXJyb3JEYXRhJ10gJiYgb2JqWydwZXJpb2QnXS5zcGxpdCgnLScpWzBdICE9IG9ialsncGVyaW9kJ10uc3BsaXQoJy0nKVsxXSl7XHJcblxyXG5cdFx0XHR0aXRsZVswXS5jbGFzc0xpc3QucmVtb3ZlKCdvbi1lcnJvcicpO1xyXG5cdFx0XHR0aXRsZVswXS5pbm5lckhUTUwgPSAnJysgdHlwZSArJyDRgSAnKyBvYmpbJ3BlcmlvZCddLnNwbGl0KCctJylbMF0gKycg0L/QviAnKyBvYmpbJ3BlcmlvZCddLnNwbGl0KCctJylbMV0gKycg0LPQvtC00YsnO1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRpZighb2JqWydlcnJvckRhdGEnXSl7XHJcblxyXG5cdFx0XHRzY2hlZHVsZUJ1aWxkKG9iaixzY2hlZHVsZVBhcmFtKTsgLy8g0L/QvtGB0YLRgNC+0LXQvdC40LUg0YLQsNCx0LvQuNGG0YtcclxuXHRcdFx0XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVCdWlsZChvYmosc2NoZWR1bGVQYXJhbSl7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coc2NoZWR1bGVQYXJhbSxvYmopO1xyXG5cdFxyXG5cdFx0dmFyIHBpID0gTWF0aC5QSTtcclxuXHRcdHZhciBjb3VudCA9IDQwO1xyXG5cdFx0dmFyIGNvdW50TGluZSA9IDQwO1xyXG5cdFx0dmFyIGNvdW50V3JhcHAgPSA0MDtcclxuXHRcdHZhciBsaW5lRGl2aXNpb24gID0gMTA7XHJcblx0XHR2YXIgY291bnREaXZpc2lvbiAgPSA1MDtcclxuXHRcdHZhciBhcnIgPSBbXTtcclxuXHRcdHZhciB0aW1lID0gMDtcclxuXHRcdHZhciBsaWdodEJsdWUgPSAnI2I0ZTZmOSc7XHJcblx0XHR2YXIgYmx1ZSA9ICcjNDI4NWY0JztcclxuXHRcdHZhciBibGFjayA9ICcjMDAwJztcclxuXHRcdHZhciBsaWdodFllbGxvdyA9ICcjZjVkYTlmJztcclxuXHRcdHZhciBjaXJjUiA9IDM7XHJcblx0XHR2YXIgY2lyY0wgPSA4O1xyXG5cdFx0dmFyIGNpcmNEID0gY2lyY1IqMiArIGNpcmNMKjI7XHJcblxyXG5cdFx0Y3R4LmNsZWFyUmVjdCgwLCAwLCA4NTAsIDU1MCk7XHJcblxyXG5cdFx0aWYoc2NoZWR1bGVQYXJhbSA9PSAndHJ1ZScgJiYgIW9ialsnZXJyb3JEYXRhJ10pe1xyXG5cclxuXHRcdFx0YnVpbGRMaW5lcyhvYmopO1xyXG5cdFx0XHRzdHJva2VNb250aChjb3VudCk7XHJcblxyXG5cdFx0XHRmb3Ioa2V5IGluIG9iail7XHJcblxyXG5cdFx0XHRcdGlmKHR5cGVvZiBvYmpba2V5XSA9PSAnbnVtYmVyJyl7XHJcblxyXG5cdFx0XHRcdFx0XHRpZihvcHBvc2l0ZShvYmpba2V5XSkgPT0gdHJ1ZSl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmKG9ialsnZGF0YVR5cGUnXSA9PSAndGVtcGVyYXR1cmUnKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gYmxhY2s7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFRleHQoJysnICsgb2JqW2tleV0sIGNvdW50LTEwLCAtIG9ialtrZXldKjUgKyAyMzUgLCA0MCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5zdHJva2VTdHlsZSA9IGxpZ2h0WWVsbG93O1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4Lm1vdmVUbyhjb3VudCwgLSBvYmpba2V5XSo1ICsgMjU1KTsgICAgICAgICAgICAgICAgICAgICAgICBcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5saW5lVG8oY291bnQsIDI2MCk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHgubGluZVdpZHRoID0gNDtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5saW5lQ2FwID0gJ2J1dHQnOyBcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5zdHJva2UoKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRjdHgubGluZVdpZHRoID0gY2lyY0w7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gYmx1ZTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5hcmMoY291bnQsIC1vYmpba2V5XSo1ICsgMjcxIC0gY2lyY0QvMiwgY2lyY1IsIDAsIDIqcGksIGZhbHNlKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5zdHJva2UoKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5maWxsKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7IFxyXG5cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0aWYob2JqWydkYXRhVHlwZSddID09ICdwcmVjaXBpdGF0aW9uJyl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGJsYWNrO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxUZXh0KG9ialtrZXldLCBjb3VudC0xMCwgLSBvYmpba2V5XSo1MCArIDIzNSAsIDQwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gbGlnaHRCbHVlO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4Lm1vdmVUbyhjb3VudCwgLSBvYmpba2V5XSo1MCArIDI1NSk7ICAgICAgICAgICAgICAgICAgICAgICAgXHJcblx0XHRcdFx0XHRcdFx0XHRjdHgubGluZVRvKGNvdW50LCAyNjApO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IDE7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHgubGluZUNhcCA9ICdidXR0JzsgXHJcblx0XHRcdFx0XHRcdFx0XHRjdHguc3Ryb2tlKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IGNpcmNMO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGJsdWU7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYXJjKGNvdW50LCAtb2JqW2tleV0qNTAgKyAyNzEgLSBjaXJjRC8yLCBjaXJjUiwgMCwgMipwaSwgZmFsc2UpO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LnN0cm9rZSgpO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmZpbGwoKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTsgXHJcblxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcclxuXHRcdFx0XHRcdFx0ZWxzZXtcclxuXHJcblx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGJsdWU7XHJcblx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxUZXh0KG9ialtrZXldLCBjb3VudC0xMCwgLSBvYmpba2V5XSo1ICsgMjgwLCA0MCApO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0Y3R4Lm1vdmVUbyhjb3VudCwgMjYwKTsgICAgICAgICAgICAgICAgICAgICAgICBcclxuXHRcdFx0XHRcdFx0XHRjdHgubGluZVRvKGNvdW50LCAtIG9ialtrZXldKjUgKyAyNjUpOyAgICAgICAgICAgICAgICAgICAgICAgXHJcblx0XHRcdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IDQ7IFxyXG5cdFx0XHRcdFx0XHRcdGN0eC5saW5lQ2FwID0gJ2J1dHQnOyBcclxuXHRcdFx0XHRcdFx0XHRjdHguc3Ryb2tlU3R5bGUgPSBsaWdodEJsdWU7XHJcblx0XHRcdFx0XHRcdFx0Y3R4LnN0cm9rZSgpO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IGNpcmNMO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5zdHJva2VTdHlsZSA9IGxpZ2h0Qmx1ZVxyXG5cdFx0XHRcdFx0XHRcdGN0eC5maWxsU3R5bGUgPSBibHVlO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5hcmMoY291bnQsIC1vYmpba2V5XSo1ICsgMjQ4LjUgKyBjaXJjRC8yLCBjaXJjUiwgMCwgMipwaSwgZmFsc2UpO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdGN0eC5zdHJva2UoKTtcclxuXHRcdFx0XHRcdFx0XHRjdHguZmlsbCgpO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGNvdW50ICs9IDYwO1xyXG5cdFx0XHRcdFx0XHRhcnIucHVzaChvYmpba2V5XSk7XHJcblx0XHRcdFx0fVx0XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdFxyXG5cdFx0XHRmb3IobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKXtcclxuXHJcblx0XHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0XHRcdGlmKG9ialsnZGF0YVR5cGUnXSA9PSAndGVtcGVyYXR1cmUnKXtcclxuXHRcdFx0XHRcdFx0Y3R4Lm1vdmVUbyhjb3VudExpbmUsIC1hcnJbaV0qNSArIDI2MCk7XHJcblx0XHRcdFx0XHRcdGNvdW50TGluZSArPSA2MDsgICAgICAgICAgICAgICAgICAgICAgXHJcblx0XHRcdFx0XHRcdGN0eC5saW5lVG8oY291bnRMaW5lLCAtYXJyW2krMV0qNSArIDI2MCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYob2JqWydkYXRhVHlwZSddID09ICdwcmVjaXBpdGF0aW9uJyl7XHJcblx0XHRcdFx0XHRcdGN0eC5tb3ZlVG8oY291bnRMaW5lLCAtYXJyW2ldKjUwICsgMjYwKTtcclxuXHRcdFx0XHRcdFx0Y291bnRMaW5lICs9IDYwOyAgICAgICAgICAgICAgICAgICAgICBcclxuXHRcdFx0XHRcdFx0Y3R4LmxpbmVUbyhjb3VudExpbmUsIC1hcnJbaSsxXSo1MCArIDI2MCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGN0eC5saW5lV2lkdGggPSAzOyAgICBcclxuXHRcdFx0XHRcdGN0eC5zdHJva2VTdHlsZSA9IGJsdWVcclxuXHRcdFx0XHRcdGN0eC5zdHJva2UoKTtcclxuXHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0fSx0aW1lICs9IDI1KTtcclxuXHJcblx0XHRcdCB9XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0aWYoc2NoZWR1bGVQYXJhbSA9PSAnZmFsc2UnICYmICFvYmpbJ2Vycm9yRGF0YSddKXtcclxuXHJcblx0XHRcdGJ1aWxkTGluZXMob2JqKTtcclxuXHRcdFx0c3Ryb2tlTW9udGgoY291bnQpO1xyXG5cclxuXHRcdFx0Zm9yKGtleSBpbiBvYmope1xyXG5cclxuXHRcdFx0XHRpZih0eXBlb2Ygb2JqW2tleV0gPT0gJ251bWJlcicpe1xyXG5cclxuXHRcdFx0XHRcdFx0aWYob2JqWydkYXRhVHlwZSddID09ICd0ZW1wZXJhdHVyZScpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZihvcHBvc2l0ZShvYmpba2V5XSkgPT0gdHJ1ZSl7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gbGlnaHRZZWxsb3c7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHgucmVjdChjb3VudCwgMjYwLCAzMCwgLSBvYmpba2V5XSo1ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHgubGluZUNhcCA9ICdyb3VuZCc7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbCgpO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5maWxsU3R5bGUgPSBibGFjaztcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5mb250ID0gJ2JvbGQgMTRweCBzYW5zLXNlcmlmJztcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5maWxsVGV4dChvYmpba2V5XSwgY291bnQsIC0gb2JqW2tleV0qNSArIDI0NSwgMzAgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRlbHNle1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGxpZ2h0Qmx1ZTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5yZWN0KGNvdW50LCAyNjAsIDMwLCAtIG9ialtrZXldKjUgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5saW5lQ2FwID0gJ3JvdW5kJztcclxuXHRcdFx0XHRcdFx0XHRcdGN0eC5maWxsKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gYmxhY2s7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZm9udCA9ICdib2xkIDE0cHggc2Fucy1zZXJpZic7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguZmlsbFRleHQob2JqW2tleV0sIGNvdW50LCAtIG9ialtrZXldKjUgKyAyODAsIDMwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHRjb3VudCArPSA2MDtcclxuXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYob2JqWydkYXRhVHlwZSddID09ICdwcmVjaXBpdGF0aW9uJyl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGN0eC5maWxsU3R5bGUgPSBsaWdodEJsdWU7XHJcblx0XHRcdFx0XHRcdFx0Y3R4LnJlY3QoY291bnQsIDI2MCwgMzAsIC0gb2JqW2tleV0qNTAgKTtcclxuXHRcdFx0XHRcdFx0XHRjdHgubGluZUNhcCA9ICdyb3VuZCc7XHJcblx0XHRcdFx0XHRcdFx0Y3R4LmZpbGwoKTtcclxuXHRcdFx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblx0XHRcdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGJsYWNrO1xyXG5cdFx0XHRcdFx0XHRcdGN0eC5mb250ID0gJ2JvbGQgMTRweCBzYW5zLXNlcmlmJztcdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdGN0eC5maWxsVGV4dChvYmpba2V5XSwgY291bnQsIC0gb2JqW2tleV0qNTAgKyAyNTUsIDMwICk7XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRjb3VudCArPSA2MDtcclxuXHRcdFx0XHRcdH1cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVx0XHRcclxuXHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gb3Bwb3NpdGUobnVtKXtcclxuXHJcblx0XHRcdGlmKG51bSA+IDApIHJldHVybiB0cnVlXHJcblxyXG5cdFx0XHRlbHNlIHJldHVybiBmYWxzZVxyXG5cdFx0XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc3Ryb2tlTW9udGgoY291bnQpe1xyXG5cclxuXHRcdFx0dmFyIG1vbnRoID0gWyfRj9C90LLQsNGA0YwnLCBcclxuXHRcdFx0XHRcdFx0ICfRhNC10LLRgNCw0LvRjCcsXHJcblx0XHRcdFx0XHRcdCAn0LzQsNGA0YInLFxyXG5cdFx0XHRcdFx0XHQgJ9Cw0L/RgNC10LvRjCcsXHJcblx0XHRcdFx0XHRcdCAn0LzQsNC5JywgXHJcblx0XHRcdFx0XHRcdCAn0LjRjtC90YwnLFxyXG5cdFx0XHRcdFx0XHQgJ9C40Y7Qu9GMJywgXHJcblx0XHRcdFx0XHRcdCAn0LDQstCz0YPRgdGCJyxcclxuXHRcdFx0XHRcdFx0ICfRgdC10L3RgtGP0LHRgNGMJywgXHJcblx0XHRcdFx0XHRcdCAn0L7QutGC0Y/QsdGA0YwnLFxyXG5cdFx0XHRcdFx0XHQgJ9C90L7Rj9Cx0YDRjCcsXHJcblx0XHRcdFx0XHRcdCAn0LTQtdC60LDQsdGA0YwnXTtcclxuXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGk8MTI7IGkrKyl7XHJcblxyXG5cdFx0XHRcdGN0eC5maWxsU3R5bGUgPSAnIzQyODVmNCc7XHJcblx0XHRcdFx0Y3R4LmZvbnQgPSAnIDExcHggc2Fucy1zZXJpZic7XHJcblx0XHRcdFx0Y3R4LmZpbGxUZXh0KG1vbnRoW2ldLCBjb3VudCwgNTMwLCA1MCApO1xyXG5cclxuXHRcdFx0XHRjb3VudCArPSA2MDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBidWlsZExpbmVzKG9iail7XHJcblxyXG5cdFx0XHRjdHgubW92ZVRvKDUsIDI2MyAtIDMpO1x0XHRcdFxyXG5cdFx0XHRjdHgubGluZVRvKDcwMiwgMjYzIC0gMyk7ICAgICAgICAgIFxyXG5cdFx0XHRjdHgubGluZVdpZHRoID0gMTsgICAgICBcclxuXHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gbGlnaHRCbHVlIDtcclxuXHRcdFx0Y3R4LmxpbmVDYXAgPSAnYnV0dCc7ICAgICAgICAgICAgICAgICAgXHJcblx0XHRcdGN0eC5zdHJva2UoKTtcclxuXHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuXHRcdFx0aWYob2JqWydkYXRhVHlwZSddID09ICd0ZW1wZXJhdHVyZScpIHtcclxuXHJcblx0XHRcdFx0Zm9yKGxldCBpID0gMDsgaSA8IDExOyBpKyspe1xyXG5cclxuXHRcdFx0XHRcdGN0eC5mb250ID0gJ2JvbGQgMTJweCBzYW5zLXNlcmlmJztcclxuXHRcdFx0XHRcdGN0eC5maWxsU3R5bGUgPSBsaWdodEJsdWU7XHJcblx0XHRcdFx0XHRpZihjb3VudERpdmlzaW9uID09IDApXHJcblx0XHRcdFx0XHRcdGN0eC5maWxsVGV4dCgnJywgMTAsIGxpbmVEaXZpc2lvbiArIDQgLCAzMCApO1xyXG5cclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0Y3R4LmZpbGxUZXh0KGNvdW50RGl2aXNpb24sIDEwLCBsaW5lRGl2aXNpb24gKyA0ICwgMzAgKTtcclxuXHRcdFx0XHRcdGNvdW50RGl2aXNpb24gLT0gMTA7XHJcblx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGxpZ2h0Qmx1ZVxyXG5cdFx0XHRcdFx0Y3R4LmFyYyg1LCBsaW5lRGl2aXNpb24sIDMsIDAsIDIqcGksIGZhbHNlKTtcclxuXHRcdFx0XHRcdGxpbmVEaXZpc2lvbiArPSA1MDtcclxuXHRcdFx0XHRcdGN0eC5maWxsKCk7XHJcblx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0XHRcdFx0Y3R4Lm1vdmVUbyg1LCAxMCk7ICAgICAgICAgICAgICAgICBcclxuXHRcdFx0XHRcdGN0eC5saW5lVG8oNSwgNTEwKTsgICAgICAgICAgICAgICAgICAgICAgIFxyXG5cdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IDI7ICAgICAgXHJcblx0XHRcdFx0XHRjdHguc3Ryb2tlU3R5bGUgPSBsaWdodEJsdWUgIFxyXG5cdFx0XHRcdFx0Y3R4LmxpbmVDYXAgPSAncm91bmQnOyAgICAgICAgICAgICAgICAgICAgIFxyXG5cdFx0XHRcdFx0Y3R4LnN0cm9rZSgpO1xyXG5cdFx0XHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblx0XHRcdGlmKG9ialsnZGF0YVR5cGUnXSA9PSAncHJlY2lwaXRhdGlvbicpIHtcclxuXHJcblx0XHRcdFx0Zm9yKGxldCBpID0gMDsgaSA8IDY7IGkrKyl7XHJcblxyXG5cdFx0XHRcdFx0Y3R4LmZvbnQgPSAnYm9sZCAxMnB4IHNhbnMtc2VyaWYnO1xyXG5cdFx0XHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGxpZ2h0Qmx1ZTtcclxuXHJcblx0XHRcdFx0XHRpZihjb3VudERpdmlzaW9uID09IDApXHJcblx0XHRcdFx0XHRcdGN0eC5maWxsVGV4dCgnJywgMTAsIGxpbmVEaXZpc2lvbiArIDQgLCAzMCApO1xyXG5cclxuXHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0Y3R4LmZpbGxUZXh0KGNvdW50RGl2aXNpb24udG9TdHJpbmcoKVswXSwgMTAsIGxpbmVEaXZpc2lvbiArIDQgLCAzMCApO1xyXG5cdFx0XHRcdFx0Y291bnREaXZpc2lvbiAtPSAxMDtcclxuXHRcdFx0XHRcdGN0eC5iZWdpblBhdGgoKTtcclxuXHJcblx0XHRcdFx0XHRjdHguZmlsbFN0eWxlID0gbGlnaHRCbHVlO1xyXG5cdFx0XHRcdFx0Y3R4LmFyYyg1LCBsaW5lRGl2aXNpb24sIDMsIDAsIDIqcGksIGZhbHNlKTtcclxuXHRcdFx0XHRcdGxpbmVEaXZpc2lvbiArPSA1MDtcclxuXHRcdFx0XHRcdGN0eC5maWxsKCk7XHJcblx0XHRcdFx0XHRjdHguYmVnaW5QYXRoKCk7XHJcblxyXG5cdFx0XHRcdFx0Y3R4Lm1vdmVUbyg1LCAxMCk7ICAgICAgICAgICAgICBcclxuXHRcdFx0XHRcdGN0eC5saW5lVG8oNSwgMjYwKTsgICAgICAgICAgICAgICAgICAgICAgIFxyXG5cdFx0XHRcdFx0Y3R4LmxpbmVXaWR0aCA9IDI7ICAgICAgXHJcblx0XHRcdFx0XHRjdHguc3Ryb2tlU3R5bGUgPSBsaWdodEJsdWUgIFxyXG5cdFx0XHRcdFx0Y3R4LmxpbmVDYXAgPSAncm91bmQnOyAgICAgICAgICAgICAgICAgICAgIFxyXG5cdFx0XHRcdFx0Y3R4LnN0cm9rZSgpO1xyXG5cdFx0XHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xyXG5cclxuXHRcdFx0XHR9XHRcclxuXHRcdFx0fVx0XHRcdFxyXG5cdFx0fVxyXG5cdH1cclxuXHJcbn0pKCk7XHJcbiJdfQ==
