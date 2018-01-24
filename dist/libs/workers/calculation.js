onmessage = function(e){


		var data = e['data'];
		var topYear = parseInt(e['data']['interval'].split('-')[0]);
		var bottYear = parseInt(e['data']['interval'].split('-')[1]);
		var arr =  e['data']['data'];
		var countYears = bottYear - topYear + 1;
		var sum = [];
		var totalMeteoData;

		//console.log(data);

		function totalObject(years,dataTypeParam){

			// this.objectType = 'totalSchedule';
			// if( dataTypeParam == 'temperature')
			// 	this.dataType = 'Температура';
			// if( dataTypeParam == 'precipitation')
			// 	this.dataType = 'Осадки';

			this.objectType = 'totalSchedule';
			this.dataType = dataTypeParam;
						

			this.period = years;
			
		}

		totalMeteoData = new totalObject(data['interval'],data['param']);

		if(topYear <= bottYear ){
			for(let i = 0; i<= arr.length-1; i++){
		
				if(parseInt(arr[i]['t'].split('-')[0]) >= topYear && parseInt(arr[i]['t'].split('-')[0]) <= bottYear)
					sum.push(arr[i]);

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
			
			totalMeteoData.addMonth(sum,countYears);
			//console.log(totalMeteoData)	;
			postMessage(totalMeteoData);
				
		}

}