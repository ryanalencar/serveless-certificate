import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda"
import { document } from "../utils/dynamodbClient"

interface IUserCertificate {
  name: string
  created_at: string
  grade: number
  id: string
}

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const { id } = event.pathParameters

  const response = await document.query({
    TableName: 'users_certificate',
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise()

  const userCertificate = response.Items[0] as IUserCertificate

  if (userCertificate) {
    return {
      statusCode: 201, body: JSON.stringify({
        message: 'Certificado válido!',
        name: userCertificate.name,
        url: `https://certificate-ignitenode.s3.amazonaws.com/${id}.pdf`
      })
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      message: 'Certificado inválido!'
    })
  }
}
