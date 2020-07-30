const mongo		=	require( 'mongodb' ).MongoClient
const objectid	=	require( 'mongodb' ).ObjectID

const mongoDBJSObject = {
	db: null,
	retryTimeout: 100,
	connectionTimeout: 30000,
	insertList: {},
	deleteList: {},
	updateList: {},
	databaseList: {},
	id: name => objectid( name ),
	start: ( isAtlas, dbName, ip, port, user, pass, timeoutInMS, callback ) => mongo.connect( ( 'mongodb' + ( isAtlas? '+srv': '' ) + '://' + ( user? escape( user ): '' ) + ( ( user && pass )? ':': '' ) + ( pass? escape( pass ): '' ) + ( ( user || pass )? '@': '' ) + escape( ip ) + ( isAtlas? '': ( ':' + parseInt( port ).toString() ) ) + '/' + escape( dbName ) + '?retryWrites=true&w=majority' ), { serverSelectionTimeoutMS: ( timeoutInMS? parseInt( timeoutInMS ): mongoDBJSObject.connectionTimeout ), useNewUrlParser: true, useUnifiedTopology: true }, ( err, db ) => {
		if( !err && db )	{
			mongoDBJSObject.databaseList[dbName] = db.db( dbName )
			mongoDBJSObject.databaseList[dbName].collection( dbName )
			callback( false, null )
		}	else	{
			callback( true, err, ( 'mongodb' + ( isAtlas? '+srv': '' ) + '://' + ( user? escape( user ): '' ) + ( ( user && pass )? ':': '' ) + ( pass? escape( pass ): '' ) + ( ( user || pass )? '@': '' ) + escape( ip ) + ( isAtlas? '': ( ':' + parseInt( port ).toString() ) ) + '/' + escape( dbName ) + '?retryWrites=true&w=majority' ) )
		}
	}),
	insert: ( dbName, table, rowOrRows, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			if( mongoDBJSObject.insertList[table] )	{
				setTimeout( () => mongoDBJSObject.insert( dbName, table, rowOrRows, callback ), mongoDBJSObject.retryTimeout )
			}	else	{
				mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => {
					if( Array.isArray( rowOrRows ) )	{
						mongoDBJSObject.insertList[table] = 1
						collection.insertMany( rowOrRows, ( err, result ) => mongoDBJSObject.insertDone( table, callback, ( err? null: result ) ) )
					}	else	{
						mongoDBJSObject.insertList[table] = 1
						collection.insertOne( rowOrRows, ( err, result ) => mongoDBJSObject.insertDone( table, callback, ( err? null: result.insertedId ) ) )
					}
				})
			}
		}
	},
	insertDone: ( table, callback, insertedId ) => {
		if( mongoDBJSObject.insertList[table] )	{
			mongoDBJSObject.insertList[table]--
			if( mongoDBJSObject.insertList[table] < 1 )	{
				delete mongoDBJSObject.insertList[table]
			}
		}
		if( callback )	{
			callback( insertedId )
		}
	},
	delete: ( dbName, table, dataToRemove, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			if( mongoDBJSObject.deleteList[table] )	{
				setTimeout( () => mongoDBJSObject.delete( dbName, table, dataToRemove, callback ), mongoDBJSObject.retryTimeout )
			}	else	{
				mongoDBJSObject.deleteList[table] = true;
				mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.deleteMany( dataToRemove, () => mongoDBJSObject.deleteDone( table, callback ) ) )
			}
		}
	},
	deleteDone: ( table, callback ) => {
		if( mongoDBJSObject.deleteList[table] )	{
			delete mongoDBJSObject.deleteList[table]
		}
		if( callback )	{
			callback()
		}
	},
	update: ( dbName, table, dataToUpdate, newData, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			if( mongoDBJSObject.updateList[table] )	{
				setTimeout( () => mongoDBJSObject.update( dbName, table, dataToUpdate, newData, callback ), mongoDBJSObject.retryTimeout )
			}	else	{
				mongoDBJSObject.updateList[table] = true
				mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.updateMany( dataToUpdate, { $set: newData }, () => mongoDBJSObject.updateDone( table, callback ) ) )
			}
		}
	},
	updateDone: ( table, callback ) => {
		if( mongoDBJSObject.updateList[table] )	{
			delete mongoDBJSObject.updateList[table]
		}
		if( callback )	{
			callback()
		}
	},
	singleQuery: ( dbName, table, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.findOne( query, ( err, item ) => callback( item ) ) );
		}
	},
	query: ( dbName, table, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.find( query ).toArray( ( err, items ) => callback( items ) ) );
		}
	},
	join: ( dbName, table, tableIDField, joinTo, joinToIDField, joinedToElement, sortBy, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => {
				let lkData = { $lookup: { from: joinTo, localField: tableIDField, foreignField: joinToIDField, as: joinedToElement } }
				collection.aggregate( [ lkData, { $match: query } ], { $sort: sortBy } ).toArray( ( err, items ) => callback( items ) )
			});
		}
	},
	joinsLimit: ( dbName, table, joins, max, sortBy, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => {
				let lookupdata = []
				for( let i = 0; i < joins.length; i++ )	{
					let lookupDataItem = { from: joins[i].from, localField: joins[i].field, foreignField: joins[i].fromField, as: joins[i].name }
					lookupdata.push( { $lookup: lookupDataItem } )
				}
				lookupdata.push( { $match: query } )
				collection.aggregate( lookupdata, { $sort: sortBy, $limit: max } ).toArray( ( err, items ) => callback( items ) )
			})
		}
	},
	querySort: ( dbName, table, sortBy, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.find( query ).sort( sortBy ).toArray( ( err, items ) => callback( items ) ) )
		}
	},
	queryLimitSort: ( dbName, table, max, sortBy, query, callback ) => {
		if( mongoDBJSObject.databaseList[dbName] )	{
			mongoDBJSObject.databaseList[dbName].collection( table, ( err, collection ) => collection.find( query ).limit( max ).sort( sortBy ).toArray( ( err, items ) => callback( items ) ) )
		}
	}
}

module.exports = mongoDBJSObject
